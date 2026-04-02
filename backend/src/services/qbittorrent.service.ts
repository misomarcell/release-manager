import { config } from '../config.js';
import { downloadTorrentFile } from './ncore.service.js';
import type { DownloadCategory } from 'shared/ncore.models';

let sessionCookie = '';

async function login(): Promise<void> {
  const { url, username, password } = config.qbittorrent;
  console.log('[qBittorrent]', `Logging in to ${url}`);

  const response = await fetch(`${url}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`qBittorrent login failed: ${response.status} ${text}`);
  }

  const setCookie = response.headers.get('set-cookie');
  const sid = setCookie?.match(/SID=([^;]+)/)?.[1];
  if (!sid) {
    throw new Error('qBittorrent login did not return a session cookie');
  }

  console.log('[qBittorrent]', 'Login successful');
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
  downloadUrl: string,
  savePath: string,
  category: DownloadCategory,
): Promise<void> {
  const { url } = config.qbittorrent;
  if (!url) {
    throw new Error('qBittorrent is not configured. Set QBITTORRENT_URL.');
  }

  const torrentData = await downloadTorrentFile(downloadUrl);
  console.log('[qBittorrent]', `Torrent file size: ${torrentData.byteLength} bytes`);

  const formData = new FormData();
  formData.append(
    'torrents',
    new Blob([torrentData], { type: 'application/x-bittorrent' }),
    'release.torrent',
  );
  formData.append('savepath', savePath);
  formData.append('category', category);

  console.log('[qBittorrent]', `Adding torrent to ${savePath} (${category})`);

  const response = await qbtFetch('/api/v2/torrents/add', {
    method: 'POST',
    body: formData,
  });

  const responseText = await response.text();
  console.log('[qBittorrent]', `Response: ${response.status} ${responseText}`);

  if (!response.ok) {
    throw new Error(`qBittorrent add failed: ${response.status} ${responseText}`);
  }
}

export async function testConnection(): Promise<{ version: string }> {
  const { url } = config.qbittorrent;
  if (!url) {
    throw new Error('qBittorrent is not configured. Set QBITTORRENT_URL.');
  }

  const response = await qbtFetch('/api/v2/app/version', { method: 'GET' });
  if (!response.ok) {
    throw new Error(`qBittorrent returned ${response.status}`);
  }

  const version = await response.text();
  return { version };
}
