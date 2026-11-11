import type { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

function viewKey(root: ActivatedRouteSnapshot): string {
    let leaf = root;
    while (leaf.firstChild) leaf = leaf.firstChild;
    const path = leaf.pathFromRoot.flatMap((route) => route.url.map((segment) => segment.path)).join('/');
    return [path, root.queryParamMap.get('open'), root.queryParamMap.get('tab')].join('|');
}

export function skipSameViewTransitions({ transition, from, to }: ViewTransitionInfo): void {
    if (viewKey(from) === viewKey(to)) transition.skipTransition();
}
