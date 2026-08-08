import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { SearchService } from '../../services/search.service';
import { extractHttpError } from '../../utils/http-error';
import { DOWNLOAD_CATEGORIES, type DownloadCategory } from '@rm/shared/constants';
import type { NcoreResult, TvInfo } from '@rm/shared/ncore.models';

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
})
export class DownloadDialogComponent {
    private search = inject(SearchService);
    private dialogRef = inject(MatDialogRef<DownloadDialogComponent>);
    protected data = inject(MAT_DIALOG_DATA) as DownloadDialogData;

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
            const result = await this.search.download({
                downloadUrl: this.data.release.download_url,
                savePath: this.savePath,
                category: this.category(),
            });
            this.dialogRef.close(result.success);
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, 'Download failed'));
        } finally {
            this.sending.set(false);
        }
    }
}
