import type { DownloadCategory } from './constants.js';
import type { TrackerId } from './tracker.models.js';

export interface DownloadRequest {
    tracker: TrackerId;
    downloadRef: string;
    savePath: string;
    category: DownloadCategory;
}

export interface DownloadResponse {
    success: boolean;
    message: string;
}
