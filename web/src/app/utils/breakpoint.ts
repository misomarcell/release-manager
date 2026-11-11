import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

const DESKTOP_QUERY = '(min-width: 960px)';

export function injectIsDesktop(): Signal<boolean> {
    return toSignal(
        inject(BreakpointObserver)
            .observe(DESKTOP_QUERY)
            .pipe(map((state) => state.matches)),
        { initialValue: false },
    );
}
