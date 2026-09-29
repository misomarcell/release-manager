import { config } from '../config.js';

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: { committer: { date: string } };
}

interface VersionInfo {
  commitHash: string;
  commitUrl: string;
  commitDate: string;
}

let cached: { data: VersionInfo; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchLatestCommit(): Promise<VersionInfo> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  const { repo, token } = config.github;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error('Invalid GITHUB_REPO format');
  }
  const url = `https://api.github.com/repos/${repo}/commits?per_page=1`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'release-manager-backend',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`GitHub API responded with ${res.status}`);
  }

  const commits = (await res.json()) as GitHubCommit[];
  if (!commits.length) {
    throw new Error('No commits found in repository');
  }

  const commit = commits[0];
  const data: VersionInfo = {
    commitHash: commit.sha.slice(0, 7),
    commitUrl: commit.html_url,
    commitDate: commit.commit.committer.date,
  };

  cached = { data, fetchedAt: Date.now() };
  return data;
}
