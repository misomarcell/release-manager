const RELEASE_STOP_TOKENS = new Set<string>([
  'AMZN',
  'APPLETV',
  'ATVP',
  'BLURAY',
  'BDRIP',
  'BDREMUX',
  'CAM',
  'COMPLETE',
  'DDP',
  'DDPA',
  'DDPLUS',
  'DL',
  'DSNP',
  'DTS',
  'DV',
  'DVDRIP',
  'DVDSCR',
  'EAC3',
  'EXTENDED',
  'FINAL',
  'HDR',
  'HDR10',
  'HDRIP',
  'HDTV',
  'HEVC',
  'HMAX',
  'HULU',
  'INTERNAL',
  'ITA',
  'MULTI',
  'NF',
  'NETFLIX',
  'PROPER',
  'RERIP',
  'REMUX',
  'REPACK',
  'SCR',
  'SEASON',
  'TRUEFRENCH',
  'UHD',
  'UNRATED',
  'WEB',
  'WEBDL',
  'WEBRIP',
  'X264',
  'X265',
  'X266',
  'H264',
  'H265',
  'H266',
  'AAC',
  'AC3',
  'DUBBED',
  'DUAL',
  'ENG',
  'EN',
  'HUN',
  'HU',
  'HUNGARIAN',
  'SUB',
  'SUBBED',
  'HARDSUB',
  'SOFTSUB',
  'READNFO',
  'NFO',
  'PROOFFIX',
  'REMASTERED',
  'IMAX',
]);

function normalize(token: string): string {
  return token.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function isYear(token: string): string {
  const n = normalize(token);
  return /^(19|20)\d{2}$/.test(n) ? n : '';
}

function isTerminator(token: string): boolean {
  const n = normalize(token);
  if (!n) return false;
  if (RELEASE_STOP_TOKENS.has(n)) return true;
  if (/^(480|576|720|1080|2160)P$/.test(n)) return true;
  if (/^S\d{1,2}(E\d{1,2})?$/.test(n)) return true;
  if (/^\d{1,2}BIT$/.test(n)) return true;
  return false;
}

function toTitleCase(value: string): string {
  if (!value) return '';
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseReleaseName(releaseName: string): { title: string; year: string } {
  if (!releaseName) return { title: '', year: '' };

  const stripped = releaseName.replace(/-[^-.\s]+$/, '');
  const normalized = stripped.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = normalized.split(' ').filter(Boolean);

  const titleTokens: string[] = [];
  let year = '';

  for (const token of tokens) {
    const cleaned = token.replace(/^[([{]+|[)\]}]+$/g, '');
    if (!cleaned) continue;

    const y = isYear(cleaned);
    if (y) {
      year = y;
      break;
    }
    if (isTerminator(cleaned)) break;

    titleTokens.push(cleaned);
  }

  if (!year) {
    const m = normalized.match(/\b(19|20)\d{2}\b/);
    year = m?.[0] ?? '';
  }

  if (titleTokens.length === 0) {
    const fallback = tokens.filter((t) => {
      const c = t.replace(/^[([{]+|[)\]}]+$/g, '');
      return Boolean(c) && !isYear(c) && !isTerminator(c);
    });
    titleTokens.push(...fallback.slice(0, 6));
  }

  return { title: toTitleCase(titleTokens.join(' ').trim()), year };
}

export function sanitizeImdbId(value: string): string {
  const n = value.trim();
  return /^tt\d{5,10}$/i.test(n) ? n.toLowerCase() : '';
}
