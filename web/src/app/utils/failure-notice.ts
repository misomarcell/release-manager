import { trackerName, type TrackerFailure } from '@rm/shared/tracker.models';

/** A service or API call that failed without breaking the page; shown by `app-failure-notice`. */
export interface FailureNotice {
    heading: string;
    detail: string;
}

export function trackerFailureNotices(failures: TrackerFailure[]): FailureNotice[] {
    return failures.map((failure) => ({
        heading: `${trackerName(failure.tracker)} lookup failed`,
        detail: failure.message,
    }));
}
