import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SettingsService } from '../../services/settings.service';
import { extractHttpError } from '../../utils/http-error';
import {
    DEFAULT_SCHEDULE,
    SCHEDULE_HOUR_STEPS,
    WEEKDAYS,
    cronToSchedule,
    describeSchedule,
    scheduleToCron,
    type Schedule,
} from '@rm/shared/schedule';
import type { ScheduledJob } from '@rm/shared/settings.models';

export interface ScheduleDialogData {
    job: ScheduledJob;
    cron: string;
    saved: boolean;
    timeZone: string;
}

type Mode = 'daily' | 'days' | 'hours';

const MODES: { id: Mode; label: string }[] = [
    { id: 'daily', label: 'Every day' },
    { id: 'days', label: 'Certain days' },
    { id: 'hours', label: 'Every few hours' },
];

const ALL_DAYS = WEEKDAYS.map((weekday) => weekday.day);

@Component({
    selector: 'app-schedule-dialog',
    imports: [
        FormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
    ],
    templateUrl: './schedule-dialog.html',
    styleUrl: './schedule-dialog.scss',
})
export class ScheduleDialogComponent {
    private store = inject(SettingsService);
    private dialogRef = inject(MatDialogRef<ScheduleDialogComponent>);
    protected data = inject(MAT_DIALOG_DATA) as ScheduleDialogData;
    private current = cronToSchedule(this.data.cron);
    private start = this.current.kind === 'custom' ? DEFAULT_SCHEDULE : this.current;

    protected modes = MODES;
    protected weekdays = WEEKDAYS;
    protected hourSteps = SCHEDULE_HOUR_STEPS;
    protected customCron = this.current.kind === 'custom' ? this.current.cron : '';

    protected mode = signal<Mode>(this.startMode());
    protected days = signal(
        this.start.kind === 'days' && this.start.days.length < 7 ? this.start.days : [1, 2, 3, 4, 5],
    );
    protected time = signal(this.start.kind === 'days' ? this.start.time : DEFAULT_SCHEDULE.time);
    protected every = signal(this.start.kind === 'hours' ? this.start.every : 6);
    protected saving = signal(false);
    protected error = signal('');

    protected schedule = computed<Schedule | null>(() => {
        if (this.mode() === 'hours') return { kind: 'hours', every: this.every() };

        const days = this.mode() === 'daily' ? ALL_DAYS : this.days();
        return days.length > 0 && this.time() ? { kind: 'days', days, time: this.time() } : null;
    });
    protected summary = computed(() => {
        const schedule = this.schedule();
        return schedule ? `Runs ${lowerFirst(describeSchedule(schedule))}` : 'Pick at least one day and a time';
    });

    protected toggleDay(day: number): void {
        this.days.update((days) => (days.includes(day) ? days.filter((other) => other !== day) : [...days, day]));
    }

    protected async save(): Promise<void> {
        const schedule = this.schedule();
        if (schedule) await this.send(scheduleToCron(schedule));
    }

    protected async reset(): Promise<void> {
        await this.send(null);
    }

    private startMode(): Mode {
        if (this.start.kind === 'hours') return 'hours';
        return this.start.kind === 'days' && this.start.days.length < 7 ? 'days' : 'daily';
    }

    private async send(cron: string | null): Promise<void> {
        this.saving.set(true);
        this.error.set('');
        try {
            await this.store.update({ [this.data.job.key]: cron });
            this.dialogRef.close();
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, 'Failed to save the schedule'));
        } finally {
            this.saving.set(false);
        }
    }
}

function lowerFirst(text: string): string {
    return text.charAt(0).toLowerCase() + text.slice(1);
}
