import { parseReleaseTags, summarizeReleaseTags, type ReleaseTag } from '@rm/shared/release-tags';
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

/** The resolutions, HDR formats and audio formats a title is known to exist in. */
export function releaseQualities(releases: TrackerRelease[]): ReleaseTag[] {
    return summarizeReleaseTags(
        releases.map((release) => release.releaseName),
        ['res', 'hdr', 'audio'],
    );
}

export function releaseResolutions(releases: TrackerRelease[]): string[] {
    return releaseQualities(releases)
        .filter((tag) => tag.kind === 'res')
        .map((tag) => tag.label);
}
