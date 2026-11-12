import { parseReleaseTags, type ReleaseTag } from '@rm/shared/release-tags';
import { trackerName, type TrackerRelease } from '@rm/shared/tracker.models';

interface ReleaseView {
    tags: ReleaseTag[];
    nameParts: string[];
    tracker: string;
}

export function describeRelease(release: TrackerRelease): ReleaseView {
    return {
        tags: parseReleaseTags(release.releaseName),
        nameParts: release.releaseName.split(/(?<=\.)/),
        tracker: trackerName(release.tracker),
    };
}

export function releaseResolutions(releases: TrackerRelease[]): string[] {
    const found = new Set<number>();
    for (const release of releases) {
        const tag = parseReleaseTags(release.releaseName).find((candidate) => candidate.kind === 'res');
        if (tag) found.add(parseInt(tag.label, 10));
    }
    return [...found].sort((a, b) => b - a).map((height) => `${height}p`);
}
