export type SettingKind = 'text' | 'url' | 'path' | 'secret';

export interface SettingField {
    key: string;
    label: string;
    kind: SettingKind;
    required?: boolean;
    hint?: string;
}

export interface SettingsGroup {
    id: string;
    name: string;
    description: string;
    fields: readonly SettingField[];
}

interface JobDefinition {
    id: string;
    key: string;
    name: string;
    description: string;
    /** The service that has to be set up before the job runs. */
    requires?: string;
}

/** Keys are `section.field` paths into the backend config. */
const GROUPS = [
    {
        id: 'qbittorrent',
        name: 'qBittorrent',
        description: 'Where downloads are sent.',
        fields: [
            { key: 'qbittorrent.url', label: 'URL', kind: 'url', hint: 'For example http://qbittorrent:8080' },
            { key: 'qbittorrent.username', label: 'Username', kind: 'text' },
            { key: 'qbittorrent.password', label: 'Password', kind: 'secret' },
            { key: 'qbittorrent.savePathMovies', label: 'Movies folder', kind: 'path', required: true },
            { key: 'qbittorrent.savePathTv', label: 'TV folder', kind: 'path', required: true },
        ],
    },
    {
        id: 'jellyfin',
        name: 'Jellyfin',
        description: 'The library that marks titles as owned.',
        fields: [
            { key: 'jellyfin.url', label: 'URL', kind: 'url', hint: 'For example http://jellyfin:8096' },
            { key: 'jellyfin.apiKey', label: 'API key', kind: 'secret' },
            { key: 'jellyfin.userId', label: 'User ID', kind: 'text', hint: 'Optional. Limits the sync to one user.' },
        ],
    },
    {
        id: 'ncore',
        name: 'nCore',
        description: 'The primary tracker.',
        fields: [
            { key: 'ncore.baseUrl', label: 'URL', kind: 'url', required: true },
            { key: 'ncore.username', label: 'Username', kind: 'text' },
            { key: 'ncore.cookiePass', label: 'Cookie pass', kind: 'secret' },
        ],
    },
    {
        id: 'apibay',
        name: 'The Pirate Bay',
        description: 'A secondary tracker, read through an apibay mirror.',
        fields: [{ key: 'apibay.baseUrl', label: 'API URL', kind: 'url', required: true }],
    },
    {
        id: 'tmdb',
        name: 'TMDB',
        description: 'Posters, ratings and plots.',
        fields: [{ key: 'tmdb.accessToken', label: 'Access token', kind: 'secret' }],
    },
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'Personal recommendations on Discover. Optional.',
        fields: [{ key: 'openai.apiKey', label: 'API key', kind: 'secret' }],
    },
    {
        id: 'github',
        name: 'GitHub',
        description: 'The version shown in the account menu.',
        fields: [
            { key: 'github.repo', label: 'Repository', kind: 'text', required: true, hint: 'owner/name' },
            { key: 'github.token', label: 'Token', kind: 'secret' },
        ],
    },
] as const satisfies readonly SettingsGroup[];

const JOBS = [
    {
        id: 'jellyfin',
        key: 'jellyfin.cronSchedule',
        name: 'Library sync',
        description: 'Reads the Jellyfin library so titles show as owned.',
        requires: 'Jellyfin',
    },
    {
        id: 'qbittorrent',
        key: 'qbittorrent.cronSchedule',
        name: 'Torrent sync',
        description: 'Reads the torrent list from qBittorrent.',
        requires: 'qBittorrent',
    },
    {
        id: 'watchlist',
        key: 'watchlist.cronSchedule',
        name: 'Watchlist check',
        description: 'Looks for new releases of followed titles.',
    },
] as const satisfies readonly JobDefinition[];

export type ScheduledJobId = (typeof JOBS)[number]['id'];
export type SettingKey = (typeof GROUPS)[number]['fields'][number]['key'] | (typeof JOBS)[number]['key'];

export interface ScheduledJob extends JobDefinition {
    id: ScheduledJobId;
    key: SettingKey;
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = GROUPS;
export const SCHEDULED_JOBS: readonly ScheduledJob[] = JOBS;

export interface SettingState {
    /** Always empty for secrets. */
    value: string;
    isSet: boolean;
    /** True when the value was saved from the UI and overrides the environment. */
    saved: boolean;
}

export interface JobState {
    id: ScheduledJobId;
    running: boolean;
    nextRun: string | null;
}

export interface SettingsResponse {
    values: Record<SettingKey, SettingState>;
    jobs: JobState[];
    timeZone: string;
    /** False when the backend has no `SETTINGS_ENCRYPTION_KEY`, so secrets cannot be stored. */
    secretsEditable: boolean;
}

/** A string saves a value, `null` goes back to the environment value; omitted keys are left alone. */
export interface SettingsUpdateRequest {
    values: Partial<Record<SettingKey, string | null>>;
}
