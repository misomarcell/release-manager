import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AdminService, type SyncStatus } from '../../services/admin.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';
import { extractHttpError } from '../../utils/http-error';

@Component({
    selector: 'app-admin',
    imports: [DatePipe, MatButtonModule, MatIconModule, MatCardModule],
    templateUrl: './admin.html',
    styleUrl: './admin.scss',
})
export class AdminComponent implements OnInit {
    private admin = inject(AdminService);
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);

    protected clearing = signal<string | null>(null);
    protected jellyfinStatus = signal<SyncStatus | null>(null);
    protected qbittorrentStatus = signal<SyncStatus | null>(null);

    ngOnInit(): void {
        void this.loadSyncStatuses();
    }

    private async loadSyncStatuses(): Promise<void> {
        await Promise.all([
            this.admin
                .getJellyfinStatus()
                .then((status) => this.jellyfinStatus.set(status))
                .catch(() => undefined),
            this.admin
                .getQbittorrentStatus()
                .then((status) => this.qbittorrentStatus.set(status))
                .catch(() => undefined),
        ]);
    }

    protected async clearMetadataCache(): Promise<void> {
        const confirmed = await this.confirm(
            'Clear metadata cache',
            'This will delete all cached TMDB metadata. The next search will re-fetch data from TMDB.',
        );
        if (!confirmed) return;

        this.clearing.set('metadata');
        try {
            const result = await this.admin.clearMetadataCache();
            this.snackBar.open(`Cleared ${result.deleted} cached entries`, 'OK', { duration: 3000 });
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to clear cache'), 'OK', { duration: 5000 });
        } finally {
            this.clearing.set(null);
        }
    }

    protected async clearExpiredData(): Promise<void> {
        const confirmed = await this.confirm(
            'Clear expired data',
            'This will remove expired challenges and sessions from the database.',
        );
        if (!confirmed) return;

        this.clearing.set('expired');
        try {
            const result = await this.admin.clearExpiredData();
            const total = result.challenges + result.sessions;
            this.snackBar.open(
                `Removed ${total} expired rows (${result.challenges} challenges, ${result.sessions} sessions)`,
                'OK',
                { duration: 3000 },
            );
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to clear expired data'), 'OK', {
                duration: 5000,
            });
        } finally {
            this.clearing.set(null);
        }
    }

    protected async logOutAllUsers(): Promise<void> {
        const confirmed = await this.confirm(
            'Log out all users',
            'This will terminate all active sessions, including your own. You will be redirected to the login page.',
        );
        if (!confirmed) return;

        this.clearing.set('sessions');
        try {
            await this.admin.logOutAllUsers();
            this.router.navigate(['/login']);
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to log out users'), 'OK', { duration: 5000 });
            this.clearing.set(null);
        }
    }

    protected async testQbittorrent(): Promise<void> {
        this.clearing.set('qbittorrent');
        try {
            const result = await this.admin.testQbittorrent();
            this.snackBar.open(`qBittorrent is reachable (${result.version})`, 'OK', { duration: 3000 });
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to reach qBittorrent'), 'OK', {
                duration: 5000,
            });
        } finally {
            this.clearing.set(null);
        }
    }

    protected async testJellyfin(): Promise<void> {
        this.clearing.set('jellyfin-test');
        try {
            const result = await this.admin.testJellyfin();
            this.snackBar.open(`Jellyfin is reachable (v${result.version})`, 'OK', { duration: 3000 });
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to reach Jellyfin'), 'OK', { duration: 5000 });
        } finally {
            this.clearing.set(null);
        }
    }

    protected async syncJellyfin(): Promise<void> {
        this.clearing.set('jellyfin-sync');
        try {
            const status = await this.admin.syncJellyfin();
            this.jellyfinStatus.set(status);
            this.snackBar.open(`Jellyfin sync complete - ${status.itemCount ?? 0} items`, 'OK', { duration: 3000 });
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Jellyfin sync failed'), 'OK', { duration: 5000 });
        } finally {
            this.clearing.set(null);
        }
    }

    protected async syncQbittorrent(): Promise<void> {
        this.clearing.set('qbittorrent-sync');
        try {
            const status = await this.admin.syncQbittorrent();
            this.qbittorrentStatus.set(status);
            this.snackBar.open(`qBittorrent sync complete - ${status.itemCount ?? 0} torrents`, 'OK', {
                duration: 4000,
            });
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'qBittorrent sync failed'), 'OK', { duration: 5000 });
        } finally {
            this.clearing.set(null);
        }
    }

    private async confirm(title: string, message: string): Promise<boolean> {
        const result = await firstValueFrom(
            this.dialog.open(ConfirmDialogComponent, { data: { title, message }, autoFocus: false }).afterClosed(),
        );
        return result === true;
    }
}
