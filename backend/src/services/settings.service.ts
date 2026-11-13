import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { canEncryptSecrets, decryptSecret, encryptSecret } from '../utils/secret-box.js';
import { getStoredSettings, saveStoredSettings, type StoredSetting } from '../repositories/settings.repository.js';
import { applySchedules, getJobStates, isValidCron } from './scheduler.service.js';
import { qbittorrentService } from './qbittorrent.service.js';
import {
    SCHEDULED_JOBS,
    SETTINGS_GROUPS,
    type SettingKey,
    type SettingKind,
    type SettingState,
    type SettingsResponse,
    type SettingsUpdateRequest,
} from 'shared/settings.models';

type Kind = SettingKind | 'schedule';

interface Definition {
    key: string;
    name: string;
    kind: Kind;
    required: boolean;
}

interface Change {
    key: string;
    /** `null` goes back to the environment value. */
    value: string | null;
    secret: boolean;
}

const MAX_LENGTH = 2048;
const CONTROL_CHARACTERS = /\p{Cc}/u;

const DEFINITIONS = new Map<string, Definition>([
    ...SETTINGS_GROUPS.flatMap((group) =>
        group.fields.map((field): [string, Definition] => [
            field.key,
            {
                key: field.key,
                name: `${group.name} ${/^[A-Z][a-z]/.test(field.label) ? field.label.toLowerCase() : field.label}`,
                kind: field.kind,
                required: field.required ?? false,
            },
        ]),
    ),
    ...SCHEDULED_JOBS.map((job): [string, Definition] => [
        job.key,
        { key: job.key, name: `${job.name} schedule`, kind: 'schedule', required: true },
    ]),
]);

const KIND_ERRORS: Record<Kind, (value: string) => string | null> = {
    text: () => null,
    secret: () => null,
    url: (value) => (isHttpUrl(value) ? null : 'must be a full http:// or https:// address'),
    path: (value) => (value.startsWith('/') ? null : 'must be an absolute path starting with /'),
    schedule: (value) => (isValidCron(value) ? null : 'is not a valid schedule'),
};

const KEY_ERRORS: Record<string, (value: string) => string | null> = {
    'github.repo': (value) => (/^[\w.-]+\/[\w.-]+$/.test(value) ? null : 'must look like owner/name'),
};

const editableConfig = config as unknown as Record<string, Record<string, string>>;
const environmentValues = new Map<string, string>();
const savedKeys = new Set<string>();

class SettingsError extends Error {
    status = 400;
}

function isHttpUrl(value: string): boolean {
    return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol);
}

function read(key: string): string {
    const [section, field] = key.split('.');
    return editableConfig[section][field];
}

function write(key: string, value: string): void {
    const [section, field] = key.split('.');
    editableConfig[section][field] = value;
}

function normalize(definition: Definition, value: string): string {
    const trimmed = value.trim();
    return definition.kind === 'url' ? trimmed.replace(/\/+$/, '') : trimmed;
}

function findError(definition: Definition, value: string): string | null {
    if (value.length > MAX_LENGTH) return 'is too long';
    if (CONTROL_CHARACTERS.test(value)) return 'contains characters that are not allowed';
    if (!value) return definition.required ? 'is required' : null;
    return KIND_ERRORS[definition.kind](value) ?? KEY_ERRORS[definition.key]?.(value) ?? null;
}

function toChange(key: string, raw: string | null | undefined): Change | null {
    const definition = DEFINITIONS.get(key);
    if (!definition) throw new SettingsError(`Unknown setting: ${key}`);

    const secret = definition.kind === 'secret';
    if (raw === undefined) return null;
    if (raw === null) return { key, value: null, secret };

    const value = normalize(definition, raw);
    if (secret && !value) return null;
    if (secret && !canEncryptSecrets()) {
        throw new SettingsError('Set SETTINGS_ENCRYPTION_KEY on the backend before saving secrets here.');
    }

    const error = findError(definition, value);
    if (error) throw new SettingsError(`${definition.name} ${error}.`);
    return { key, value, secret };
}

function toStored(change: Change & { value: string }): StoredSetting {
    return change.secret
        ? { key: change.key, value: encryptSecret(change.value), encrypted: true }
        : { key: change.key, value: change.value, encrypted: false };
}

function applyChange(change: Change): void {
    if (change.value === null) {
        savedKeys.delete(change.key);
        write(change.key, environmentValues.get(change.key) ?? '');
        return;
    }
    savedKeys.add(change.key);
    write(change.key, change.value);
}

function applyStored(setting: StoredSetting): void {
    const definition = DEFINITIONS.get(setting.key);
    if (!definition) return;

    try {
        const value = setting.encrypted ? decryptSecret(setting.value) : setting.value;
        const error = findError(definition, value);
        if (error) throw new Error(`${definition.name} ${error}`);
        applyChange({ key: setting.key, value, secret: setting.encrypted });
    } catch (err: unknown) {
        logger.warn('Saved setting ignored, using the environment value', {
            key: setting.key,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

/** Reads saved settings over the environment config. Call once, after the database is ready. */
export async function loadSettings(): Promise<void> {
    DEFINITIONS.forEach((_definition, key) => environmentValues.set(key, read(key)));
    (await getStoredSettings()).forEach(applyStored);
}

export function getSettings(): SettingsResponse {
    const values = Object.fromEntries(
        [...DEFINITIONS.values()].map((definition): [string, SettingState] => {
            const value = read(definition.key);
            return [
                definition.key,
                {
                    value: definition.kind === 'secret' ? '' : value,
                    isSet: value !== '',
                    saved: savedKeys.has(definition.key),
                },
            ];
        }),
    ) as Record<SettingKey, SettingState>;

    return {
        values,
        jobs: getJobStates(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        secretsEditable: canEncryptSecrets(),
    };
}

/** Validates everything first, then stores and applies the changes without a restart. */
export async function updateSettings(values: SettingsUpdateRequest['values'], by: string): Promise<void> {
    const changes = Object.entries(values)
        .map(([key, raw]) => toChange(key, raw))
        .filter((change) => change !== null);
    if (changes.length === 0) return;

    const upserts = changes.filter((change): change is Change & { value: string } => change.value !== null);
    const removals = changes.filter((change) => change.value === null).map((change) => change.key);
    await saveStoredSettings(upserts.map(toStored), removals);

    changes.forEach(applyChange);
    if (changes.some((change) => change.key.startsWith('qbittorrent.'))) qbittorrentService.resetSession();
    applySchedules();

    logger.info('Admin: settings updated', {
        saved: upserts.map((change) => change.key),
        reset: removals,
        by,
    });
}
