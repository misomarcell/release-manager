import { parseReleaseTags, type ReleaseTag } from '@rm/shared/release-tags';
import { trackerName } from '@rm/shared/tracker.models';
import type { NcoreResult } from '@rm/shared/ncore.models';

interface ReleaseView {
    tags: ReleaseTag[];
    nameParts: string[];
    tracker: string;
}

export function describeRelease(release: NcoreResult): ReleaseView {
    return {
        tags: parseReleaseTags(release.release_name),
        nameParts: release.release_name.split(/(?<=\.)/),
        tracker: trackerName(release.tracker),
    };
}

export function releaseResolutions(releases: NcoreResult[]): string[] {
    const found = new Set<number>();
    for (const release of releases) {
        const tag = parseReleaseTags(release.release_name).find((candidate) => candidate.kind === 'res');
        if (tag) found.add(parseInt(tag.label, 10));
    }
    return [...found].sort((a, b) => b - a).map((height) => `${height}p`);
}
