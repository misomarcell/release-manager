import {
    Component,
    inject,
    input,
    output,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { RecommendationDetailDialogComponent } from '../recommendation-detail-dialog/recommendation-detail-dialog';
import type { Recommendation } from '@rm/shared/recommendations.models';

@Component({
    selector: 'app-recommendation-ribbons',
    imports: [MatIconModule],
    templateUrl: './recommendation-ribbons.html',
    styleUrl: './recommendation-ribbons.scss',
})
export class RecommendationRibbonsComponent {
    private dialog = inject(MatDialog);
    private router = inject(Router);

    movies = input.required<Recommendation[]>();
    tvShows = input.required<Recommendation[]>();
    loadingMovies = input(false);
    loadingTv = input(false);
    showRefreshMovies = input(false);
    showRefreshTv = input(false);
    emptyMovieText = input('No movie recommendations available.');
    emptyTvText = input('No TV show recommendations available.');

    refreshMovies = output<void>();
    refreshTv = output<void>();

    protected skeletonItems = [0, 1, 2, 3, 4];

    protected openDetail(rec: Recommendation): void {
        const ref = this.dialog.open(RecommendationDetailDialogComponent, {
            data: { rec },
            maxWidth: '480px',
            width: '90vw',
            autoFocus: false,
        });
        ref.afterClosed().subscribe((result: string | null | undefined) => {
            if (result) {
                this.router.navigate(['/releases'], { queryParams: { q: result } });
            }
        });
    }
}
