import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-nfo-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './nfo-dialog.html',
  styleUrl: './nfo-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NfoDialogComponent {
  protected data = inject<{ html: string }>(MAT_DIALOG_DATA);
}
