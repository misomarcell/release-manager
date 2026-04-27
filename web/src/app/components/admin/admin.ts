import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';
import { extractHttpError } from '../../utils/http-error';

@Component({
  selector: 'app-admin',
  imports: [MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  private admin = inject(AdminService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  protected clearing = signal<string | null>(null);

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

  private async confirm(title: string, message: string): Promise<boolean> {
    const result = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, { data: { title, message }, autoFocus: false }).afterClosed(),
    );
    return result === true;
  }
}
