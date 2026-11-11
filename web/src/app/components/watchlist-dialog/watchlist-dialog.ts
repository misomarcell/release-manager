import { Component, computed, inject, signal } from '@angular/core';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PosterComponent } from '../poster/poster';
import { WatchlistService } from '../../services/watchlist.service';
import { extractHttpError } from '../../utils/http-error';
import type { MediaType } from '@rm/shared/tmdb.models';
import {
    WATCHLIST_MAX_KEYWORDS,
    WATCHLIST_MAX_KEYWORD_LENGTH,
    type WatchlistItem,
} from '@rm/shared/watchlist.models';

export interface WatchlistDialogData {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    year?: string | null;
    poster?: string | null;
    item: WatchlistItem | null;
}

export type WatchlistDialogResult = 'added' | 'updated' | 'removed';

const KEYWORD_SUGGESTIONS = ['2160p', '1080p', 'BluRay', 'Blu-ray', 'REMUX', 'WEB-DL', 'HUN', 'DV', 'HDR'];

@Component({
    selector: 'app-watchlist-dialog',
    imports: [
        MatDialogModule,
        MatButtonModule,
        MatChipsModule,
        MatFormFieldModule,
        MatIconModule,
        MatProgressBarModule,
        PosterComponent,
    ],
    templateUrl: './watchlist-dialog.html',
    styleUrl: './watchlist-dialog.scss',
})
export class WatchlistDialogComponent {
    private watchlist = inject(WatchlistService);
    private dialogRef = inject(MatDialogRef<WatchlistDialogComponent, WatchlistDialogResult>);
    protected data = inject(MAT_DIALOG_DATA) as WatchlistDialogData;

    protected separatorKeys = [ENTER, COMMA];
    protected suggestions = KEYWORD_SUGGESTIONS;
    protected maxKeywordLength = WATCHLIST_MAX_KEYWORD_LENGTH;
    protected keywords = signal<string[]>(this.data.item?.keywords ?? []);
    protected saving = signal(false);
    protected error = signal('');
    protected limitReached = computed(() => this.keywords().length >= WATCHLIST_MAX_KEYWORDS);

    protected hasKeyword(keyword: string): boolean {
        return this.keywords().some((existing) => existing.toLowerCase() === keyword.toLowerCase());
    }

    protected addFromInput(event: MatChipInputEvent): void {
        this.addKeyword(event.value);
        event.chipInput.clear();
    }

    protected toggleSuggestion(keyword: string): void {
        if (this.hasKeyword(keyword)) {
            this.removeKeyword(keyword);
        } else {
            this.addKeyword(keyword);
        }
    }

    protected removeKeyword(keyword: string): void {
        this.keywords.update((keywords) =>
            keywords.filter((existing) => existing.toLowerCase() !== keyword.toLowerCase()),
        );
    }

    protected async save(): Promise<void> {
        const item = this.data.item;
        await this.run('Failed to save watchlist item', async () => {
            if (item) {
                await this.watchlist.updateKeywords(item.id, this.keywords());
                return 'updated';
            }
            await this.watchlist.add({
                tmdbId: this.data.tmdbId,
                mediaType: this.data.mediaType,
                keywords: this.keywords(),
            });
            return 'added';
        });
    }

    protected async remove(): Promise<void> {
        const item = this.data.item;
        if (!item) return;
        await this.run('Failed to remove watchlist item', async () => {
            await this.watchlist.remove(item.id);
            return 'removed';
        });
    }

    private addKeyword(value: string): void {
        const keyword = value.trim().slice(0, WATCHLIST_MAX_KEYWORD_LENGTH);
        if (!keyword || this.hasKeyword(keyword) || this.limitReached()) return;
        this.keywords.update((keywords) => [...keywords, keyword]);
    }

    private async run(fallback: string, action: () => Promise<WatchlistDialogResult>): Promise<void> {
        this.saving.set(true);
        this.error.set('');
        try {
            this.dialogRef.close(await action());
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, fallback));
        } finally {
            this.saving.set(false);
        }
    }
}
