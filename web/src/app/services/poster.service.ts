import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PosterDialogComponent } from '../components/poster-dialog/poster-dialog';

@Injectable({ providedIn: 'root' })
export class PosterService {
  private dialog = inject(MatDialog);

  open(thumbnailUrl: string, alt: string): void {
    const fullSizeUrl = thumbnailUrl.replace('/w342/', '/original/');
    this.dialog.open(PosterDialogComponent, {
      data: { thumbnailUrl, fullSizeUrl, alt },
      panelClass: 'poster-overlay',
    });
  }
}
