import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { extractHttpError } from '../../utils/http-error';
import type { LogEntry, LogLevel } from '@rm/shared/log.models';
import { PageTitleComponent } from '../page-title/page-title';

const PAGE_SIZE = 100;
@Component({
    selector: 'app-logs',
    imports: [
        PageTitleComponent,
        DatePipe,
        JsonPipe,
        FormsModule,
        MatButtonToggleModule,
        MatProgressBarModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
    ],
    templateUrl: './logs.html',
    styleUrl: './logs.scss',
})
export class LogsComponent implements OnInit {
    private admin = inject(AdminService);

    protected logs = signal<LogEntry[]>([]);
    protected total = signal(0);
    protected loading = signal(false);
    protected error = signal<string | null>(null);
    protected levelFilter = signal<LogLevel | ''>('');
    protected offset = signal(0);

    protected readonly pageSize = PAGE_SIZE;

    ngOnInit(): void {
        void this.load();
    }

    protected async onFilterChange(): Promise<void> {
        this.offset.set(0);
        await this.load();
    }

    protected async prevPage(): Promise<void> {
        this.offset.update((o) => Math.max(0, o - PAGE_SIZE));
        await this.load();
    }

    protected async nextPage(): Promise<void> {
        this.offset.update((o) => o + PAGE_SIZE);
        await this.load();
    }

    protected levelIcon(level: LogLevel): string {
        const icons: Record<LogLevel, string> = { info: 'info', warn: 'warning', error: 'error' };
        return icons[level];
    }

    protected get currentPage(): number {
        return Math.floor(this.offset() / PAGE_SIZE) + 1;
    }

    protected get totalPages(): number {
        return Math.max(1, Math.ceil(this.total() / PAGE_SIZE));
    }

    private async load(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);
        try {
            const level = this.levelFilter() || null;
            const result = await this.admin.getLogs(level, PAGE_SIZE, this.offset());
            this.logs.set(result.logs);
            this.total.set(result.total);
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, 'Failed to load logs'));
        } finally {
            this.loading.set(false);
        }
    }
}
