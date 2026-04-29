import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RecommendationsService } from '../../services/recommendations.service';
import type { MovieDetailMetadata } from '@rm/shared/tmdb.models';

@Component({
  selector: 'app-media-details',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './media-details.html',
  styleUrl: './media-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaDetailsComponent {
  protected recommendations = inject(RecommendationsService);

  tmdbId = input<number | null>(null);
  mediaType = input<'movie' | 'tv' | null>(null);
  imdbId = input<string>('');
  detail = input<MovieDetailMetadata | null>(null);
  detailLoading = input<boolean>(false);
  title = input<string>('');
  genre = input<string>('');
  year = input<string>('');

  protected async sendFeedback(value: 'like' | 'dislike'): Promise<void> {
    const id = this.tmdbId();
    const type = this.mediaType();
    if (!id || !type) return;
    await this.recommendations.submitFeedback(
      {
        tmdbId: id,
        mediaType: type,
        title: this.title(),
        genre: this.genre(),
        year: this.year(),
        plot: this.detail()?.plot,
      },
      value,
    );
  }

  protected feedbackKey(): string | null {
    const id = this.tmdbId();
    const type = this.mediaType();
    return id && type ? `${type}:${id}` : null;
  }
}
