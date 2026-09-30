import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  private swUpdate = inject(SwUpdate);
  private snackBar = inject(MatSnackBar);
  private platformId = inject(PLATFORM_ID);

  init(): void {
    if (!isPlatformBrowser(this.platformId) || !this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        const snack = this.snackBar.open('A new version is available.', 'Reload', {
          duration: 0,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
        snack.onAction().subscribe(() => {
          void this.swUpdate.activateUpdate().then(() => {
            document.location.reload();
          });
        });
      });

    this.swUpdate.unrecoverable.subscribe(() => document.location.reload());
  }
}
