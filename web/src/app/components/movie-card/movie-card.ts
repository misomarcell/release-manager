import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import type { NcoreResult } from '../../../../../shared/src/ncore.models';

@Component({
  selector: 'app-movie-card',
  imports: [MatExpansionModule, MatChipsModule, MatIconModule],
  template: `
    @let t = torrent();
    <mat-expansion-panel>
      <mat-expansion-panel-header>
        <div class="card-summary">
          <span class="card-index">{{ index() }}.</span>
          <div class="poster-thumb">
            @if (t.omdb?.poster) {
              <img [src]="t.omdb?.poster" [alt]="t.omdb?.title || t.release_name" loading="lazy" />
            } @else {
              <div class="no-poster">
                <mat-icon>movie</mat-icon>
              </div>
            }
          </div>
          <div class="card-info">
            <span class="title">{{ t.omdb?.title || t.omdb_lookup.title || t.release_name }}</span>
            <span class="meta">
              @if (t.omdb?.year) {
                {{ t.omdb?.year }} ·
              }
              @if (t.omdb?.imdbRating) {
                ⭐ {{ t.omdb?.imdbRating }} ·
              }
              @if (t.omdb?.genre) {
                {{ t.omdb?.genre }} ·
              }
              {{ formatBytes(t.size) }}
            </span>
          </div>
          <div class="card-badges">
            @if (t.freeleech) {
              <mat-chip highlighted>FL</mat-chip>
            }
            <span class="seeders" [attr.aria-label]="'Seeders: ' + t.seeders"
              >▲ {{ t.seeders }}</span
            >
          </div>
        </div>
      </mat-expansion-panel-header>

      <div class="card-details">
        <div class="detail-grid">
          <div class="detail-poster">
            @if (t.omdb?.poster) {
              <img [src]="t.omdb?.poster" [alt]="t.omdb?.title || t.release_name" loading="lazy" />
            }
          </div>
          <div class="detail-info">
            @if (t.omdb?.plot) {
              <p class="plot">{{ t.omdb?.plot }}</p>
            }
            <p><strong>Release:</strong> {{ t.release_name }}</p>
            <p><strong>Category:</strong> {{ t.category }}</p>
            <p><strong>Type:</strong> {{ t.type }}</p>
            @if (t.omdb?.rated) {
              <p><strong>Rating:</strong> {{ t.omdb?.rated }}</p>
            }
            @if (t.omdb?.runtime) {
              <p><strong>Runtime:</strong> {{ t.omdb?.runtime }}</p>
            }
            <p><strong>Size:</strong> {{ formatBytes(t.size) }}</p>
            <p>
              <strong>Seeders:</strong> {{ t.seeders }} · <strong>Leechers:</strong>
              {{ t.leechers }}
            </p>
            @if (t.imdb_id) {
              <p>
                <strong>IMDb:</strong>
                <a
                  [href]="'https://www.imdb.com/title/' + t.imdb_id"
                  target="_blank"
                  rel="noopener"
                  >{{ t.imdb_id }}</a
                >
              </p>
            }
            <p>
              <strong>Freeleech:</strong> {{ t.freeleech ? 'Yes' : 'No' }} · <strong>Cache:</strong>
              {{ t.fromCache ? 'Yes' : 'No' }}
            </p>
            <div class="detail-actions">
              <a [href]="t.details_url" target="_blank" rel="noopener">Details (nCore)</a>
            </div>
          </div>
        </div>
      </div>
    </mat-expansion-panel>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 0.5rem;
    }
    .card-summary {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      min-width: 0;
    }
    .card-index {
      font-weight: 600;
      min-width: 2rem;
      text-align: right;
      color: var(--mat-sys-on-surface-variant);
    }
    .poster-thumb {
      width: 40px;
      height: 56px;
      flex-shrink: 0;
      border-radius: 4px;
      overflow: hidden;
    }
    .poster-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .no-poster {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background: var(--mat-sys-surface-variant);
      color: var(--mat-sys-on-surface-variant);
    }
    .no-poster mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .card-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-badges {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .seeders {
      color: #4caf50;
      font-weight: 600;
      font-size: 0.85rem;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 1rem;
    }
    .detail-poster img {
      width: 100%;
      border-radius: 8px;
    }
    .detail-info p {
      margin: 0.25rem 0;
      font-size: 0.9rem;
    }
    .plot {
      font-style: italic;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 0.75rem !important;
    }
    .detail-actions {
      margin-top: 0.75rem;
    }
    .detail-actions a {
      color: var(--mat-sys-primary);
    }
    @media (max-width: 600px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }
      .detail-poster {
        display: none;
      }
      .poster-thumb {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieCardComponent {
  torrent = input.required<NcoreResult>();
  index = input.required<number>();

  protected formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const val = bytes / 1024 ** i;
    return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
  }
}
