import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import type { GroupedMovie } from '../search/search';

@Component({
  selector: 'app-movie-card',
  imports: [MatExpansionModule, MatButtonModule, MatIconModule, MatDividerModule],
  templateUrl: './movie-card.html',
  styleUrl: './movie-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieCardComponent {
  movie = input.required<GroupedMovie>();
  searchTitle = output<string>();

  protected displayTitle = computed(() => {
    const m = this.movie();
    return m.omdb?.title || m.omdb_lookup.title;
  });

  protected onSearchTitle(): void {
    const clean = this.displayTitle()
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    this.searchTitle.emit(clean);
  }

  protected formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const val = bytes / 1024 ** i;
    return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
  }
}
