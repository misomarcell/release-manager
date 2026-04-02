import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

interface PosterDialogData {
  url: string;
  alt: string;
}

@Component({
  selector: 'app-poster-dialog',
  imports: [MatDialogModule],
  templateUrl: './poster-dialog.html',
  styleUrl: './poster-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosterDialogComponent {
  protected data = inject<PosterDialogData>(MAT_DIALOG_DATA);
}
