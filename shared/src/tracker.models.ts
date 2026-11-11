export const TRACKERS = [{ id: 'ncore', name: 'nCore' }] as const;

export type TrackerId = (typeof TRACKERS)[number]['id'];

export function trackerName(id: TrackerId): string {
    return TRACKERS.find((tracker) => tracker.id === id)?.name ?? id;
}
