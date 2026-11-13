import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { extractHttpError } from '../../utils/http-error';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';
import type {
    SettingField,
    SettingKey,
    SettingState,
    SettingsGroup,
    SettingsUpdateRequest,
} from '@rm/shared/settings.models';

export interface SettingsDialogData {
    group: SettingsGroup;
}

interface FieldView {
    key: SettingKey;
    label: string;
    secret: boolean;
    code: boolean;
    locked: boolean;
    required: boolean;
    hint: string;
    initial: string;
}

const CODE_KINDS: SettingField['kind'][] = ['url', 'path'];

@Component({
    selector: 'app-settings-dialog',
    imports: [
        FormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
    ],
    templateUrl: './settings-dialog.html',
    styleUrl: './settings-dialog.scss',
})
export class SettingsDialogComponent {
    private store = inject(SettingsService);
    private dialog = inject(MatDialog);
    private dialogRef = inject(MatDialogRef<SettingsDialogComponent, boolean>);
    private settings = this.store.settings();

    protected group = (inject(MAT_DIALOG_DATA) as SettingsDialogData).group;
    protected fields = this.group.fields.map((field) => this.toFieldView(field));
    protected form: Record<string, string> = Object.fromEntries(this.fields.map((field) => [field.key, field.initial]));
    protected secretsLocked = this.fields.some((field) => field.locked);
    protected hasSaved = this.fields.some((field) => this.state(field.key)?.saved);
    protected saving = signal(false);
    protected error = signal('');

    protected async save(): Promise<void> {
        const values: SettingsUpdateRequest['values'] = {};
        for (const field of this.fields) {
            const value = this.form[field.key].trim();
            const changed = field.secret ? value !== '' : value !== field.initial;
            if (changed) values[field.key] = value;
        }

        if (Object.keys(values).length === 0) {
            this.dialogRef.close(false);
            return;
        }
        await this.send(values);
    }

    protected async reset(): Promise<void> {
        const confirmed = await firstValueFrom(
            this.dialog
                .open(ConfirmDialogComponent, {
                    data: {
                        title: `Reset ${this.group.name}?`,
                        message:
                            'Everything saved here for this service is removed, including secrets. The values from the environment are used again.',
                        confirmLabel: 'Reset',
                    },
                    autoFocus: false,
                })
                .afterClosed(),
        );
        if (confirmed !== true) return;

        await this.send(Object.fromEntries(this.fields.map((field) => [field.key, null])));
    }

    private async send(values: SettingsUpdateRequest['values']): Promise<void> {
        this.saving.set(true);
        this.error.set('');
        try {
            await this.store.update(values);
            this.dialogRef.close(true);
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, 'Failed to save the settings'));
        } finally {
            this.saving.set(false);
        }
    }

    private state(key: SettingKey): SettingState | undefined {
        return this.settings?.values[key];
    }

    private toFieldView(field: SettingField): FieldView {
        const key = field.key as SettingKey;
        const secret = field.kind === 'secret';
        const locked = secret && !this.settings?.secretsEditable;
        return {
            key,
            label: field.label,
            secret,
            code: CODE_KINDS.includes(field.kind),
            locked,
            required: field.required ?? false,
            hint: secret ? this.secretHint(locked, this.state(key)?.isSet) : (field.hint ?? ''),
            initial: this.state(key)?.value ?? '',
        };
    }

    private secretHint(locked: boolean, isSet: boolean | undefined): string {
        if (locked) return isSet ? 'Set in the environment.' : 'Not set.';
        return isSet ? 'A value is set. Leave this empty to keep it.' : 'Not set yet.';
    }
}
