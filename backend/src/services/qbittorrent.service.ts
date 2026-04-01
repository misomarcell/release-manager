import { config } from '../config.js';
import { downloadTorrentFile } from './ncore.service.js';
import type { DownloadCategory } from 'shared/ncore.models';

let sessionCookie = '';

async function login(): Promise<void> {
  const { url, username, password } = config.qbittorrent;

  const response = await fetch(`${url}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`qBittorrent login failed: ${response.status}`);
  }

  const setCookie = response.headers.get('set-cookie');
  const sid = setCookie?.match(/SID=([^;]+)/)?.[1];
  if (!sid) {
    throw new Error('qBittorrent login did not return a session cookie');
  }

  sessionCookie = `SID=${sid}`;
}

async function qbtFetch(path: string, init: RequestInit): Promise<Response> {
  const { url } = config.qbittorrent;

  let response = await fetch(`${url}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Cookie: sessionCookie },
  });

  if (response.status === 403) {
    await login();
    response = await fetch(`${url}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Cookie: sessionCookie },
    });
  }

  return response;
}

export async function addTorrent(
  torrentId: string,
  savePath: string,
  category: DownloadCategory,
): Promise<void> {
  const { url } = config.qbittorrent;
  if (!url) {
    throw new Error('qBittorrent is not configured. Set QBITTORRENT_URL.');
  }

  const torrentData = await downloadTorrentFile(torrentId);

  const formData = new FormData();
  formData.append(
    'torrents',
    new Blob([torrentData], { type: 'application/x-bittorrent' }),
    'release.torrent',
  );
  formData.append('savepath', savePath);
  formData.append('category', category);

  console.log('[qBittorrent]', `Adding torrent ${torrentId} to ${savePath} (${category})`);

  const response = await qbtFetch('/api/v2/torrents/add', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`qBittorrent add failed: ${response.status} ${text}`);
  }
}
