import type { MatDialogConfig } from '@angular/material/dialog';

export function sheetConfig<D>(
    data: D,
    width = 520,
    autoFocus: MatDialogConfig['autoFocus'] = false,
): MatDialogConfig<D> {
    return { data, panelClass: 'sheet', width: `${width}px`, maxWidth: '100vw', autoFocus };
}
