import type { DownloadCategory } from './constants.js';

export interface DownloadRequest {
  downloadUrl: string;
  savePath: string;
  category: DownloadCategory;
}

export interface DownloadResponse {
  success: boolean;
  message: string;
}
