import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../services/api.service';
import {
  DOWNLOAD_CATEGORIES,
  type NcoreResult,
  type TvInfo,
  type DownloadCategory,
} from '@rm/shared/ncore.models';

export interface DownloadDialogData {
  release: NcoreResult;
  title: string;
  isTV: boolean;
  suggestedPath: string;
  category: DownloadCategory;
}

@Component({
  selector: 'app-download-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
  ],
  templateUrl: './download-dialog.html',
  styleUrl: './download-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DownloadDialogComponent {
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<DownloadDialogComponent>);
  protected data = inject<DownloadDialogData>(MAT_DIALOG_DATA);

  protected categories = DOWNLOAD_CATEGORIES;
  protected category = signal<DownloadCategory>(this.data.category);
  protected savePath = this.data.suggestedPath;
  protected sending = signal(false);
  protected error = signal('');

  protected formatTvLabel(tvInfo: TvInfo): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    switch (tvInfo.type) {
      case 'episode':
        return `Episode (S${pad(tvInfo.season!)}E${pad(tvInfo.episode!)})`;
      case 'season':
        return `Season Pack (S${pad(tvInfo.season!)})`;
      case 'series':
        return 'Series Pack';
    }
  }

  protected async onDownload(): Promise<void> {
    this.sending.set(true);
    this.error.set('');
    try {
      const result = await this.api.download({
        downloadUrl: this.data.release.download_url,
        savePath: this.savePath,
        category: this.category(),
      });
      this.dialogRef.close(result.success);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Download failed');
    } finally {
      this.sending.set(false);
    }
  }
}
