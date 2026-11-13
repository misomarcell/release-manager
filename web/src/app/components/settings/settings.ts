import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { SettingsService } from '../../services/settings.service';
import { extractHttpError } from '../../utils/http-error';
import type { FailureNotice } from '../../utils/failure-notice';
import { sheetConfig } from '../../utils/sheet';
import { FailureNoticeComponent } from '../failure-notice/failure-notice';
import { PageTitleComponent } from '../page-title/page-title';
import { ScheduleDialogComponent, type ScheduleDialogData } from '../schedule-dialog/schedule-dialog';
import { SettingsDialogComponent, type SettingsDialogData } from '../settings-dialog/settings-dialog';
import { cronToSchedule, describeSchedule } from '@rm/shared/schedule';
import {
    SCHEDULED_JOBS,
    SETTINGS_GROUPS,
    type ScheduledJob,
    type SettingField,
    type SettingKey,
    type SettingsGroup,
    type SettingsResponse,
} from '@rm/shared/settings.models';

interface JobRow {
    job: ScheduledJob;
    summary: string;
    status: string;
}

interface FieldRow {
    key: string;
    label: string;
    text: string;
    mono: boolean;
    secret: boolean;
    empty: boolean;
    saved: boolean;
}

interface GroupView {
    group: SettingsGroup;
    rows: FieldRow[];
    testable: boolean;
}

interface TestResult {
    ok: boolean;
    text: string;
}

const MONO_KINDS: SettingField['kind'][] = ['url', 'path'];

@Component({
    selector: 'app-settings',
    imports: [PageTitleComponent, FailureNoticeComponent, MatButtonModule, MatIconModule],
    templateUrl: './settings.html',
    styleUrl: './settings.scss',
})
export class SettingsComponent implements OnInit {
    private admin = inject(AdminService);
    private dialog = inject(MatDialog);
    private store = inject(SettingsService);

    private tests: Record<string, () => Promise<{ version: string }>> = {
        qbittorrent: () => this.admin.testQbittorrent(),
        jellyfin: () => this.admin.testJellyfin(),
    };

    protected failures = signal<FailureNotice[]>([]);
    protected testing = signal<string | null>(null);
    protected results = signal<Record<string, TestResult>>({});
    protected timeZone = computed(() => this.store.settings()?.timeZone ?? '');
    protected jobs = computed(() => {
        const settings = this.store.settings();
        return settings ? SCHEDULED_JOBS.map((job) => this.toJobRow(job, settings)) : [];
    });
    protected groups = computed(() => {
        const settings = this.store.settings();
        return settings ? SETTINGS_GROUPS.map((group) => this.toGroupView(group, settings)) : [];
    });

    ngOnInit(): void {
        this.store.load().catch((e: unknown) =>
            this.failures.set([
                {
                    heading: 'Settings could not be loaded',
                    detail: extractHttpError(e, 'The backend did not answer.'),
                },
            ]),
        );
    }

    protected editSchedule(job: ScheduledJob): void {
        const settings = this.store.settings();
        if (!settings) return;

        const state = settings.values[job.key];
        const data: ScheduleDialogData = { job, cron: state.value, saved: state.saved, timeZone: settings.timeZone };
        this.dialog.open(ScheduleDialogComponent, sheetConfig(data));
    }

    protected async edit(view: GroupView): Promise<void> {
        const data: SettingsDialogData = { group: view.group };
        const saved = await firstValueFrom(
            this.dialog
                .open<SettingsDialogComponent, SettingsDialogData, boolean>(SettingsDialogComponent, sheetConfig(data))
                .afterClosed(),
        );
        if (saved && view.testable) await this.test(view.group);
    }

    protected async test(group: SettingsGroup): Promise<void> {
        this.testing.set(group.id);
        let result: TestResult;
        try {
            const { version } = await this.tests[group.id]();
            result = { ok: true, text: `Connected, version ${version.replace(/^v/, '')}` };
        } catch (e: unknown) {
            result = { ok: false, text: `Not reachable: ${extractHttpError(e, 'no answer')}` };
        }
        this.results.update((results) => ({ ...results, [group.id]: result }));
        this.testing.set(null);
    }

    private toJobRow(job: ScheduledJob, settings: SettingsResponse): JobRow {
        const state = settings.jobs.find((candidate) => candidate.id === job.id);
        const nextRun = state?.nextRun ? formatDate(state.nextRun, 'EEE d MMM, HH:mm', 'en-US') : '';
        return {
            job,
            summary: describeSchedule(cronToSchedule(settings.values[job.key].value)),
            status: state?.running ? `Next run ${nextRun}` : `Off until ${job.requires} is set up`,
        };
    }

    private toGroupView(group: SettingsGroup, settings: SettingsResponse): GroupView {
        return {
            group,
            rows: group.fields.map((field) => this.toFieldRow(field, settings)),
            testable: group.id in this.tests,
        };
    }

    private toFieldRow(field: SettingField, settings: SettingsResponse): FieldRow {
        const state = settings.values[field.key as SettingKey];
        const secret = field.kind === 'secret';
        return {
            key: field.key,
            label: field.label,
            text: this.valueText(secret, state.isSet, state.value),
            mono: MONO_KINDS.includes(field.kind) && state.isSet,
            secret: secret && state.isSet,
            empty: !state.isSet,
            saved: state.saved,
        };
    }

    private valueText(secret: boolean, isSet: boolean, value: string): string {
        if (!isSet) return 'Not set';
        return secret ? 'Set' : value;
    }
}
