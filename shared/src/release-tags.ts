export type ReleaseTagKind = 'res' | 'hdr' | 'plain' | 'audio';

export interface ReleaseTag {
    label: string;
    kind: ReleaseTagKind;
}

type TagOption = [pattern: string, label: string];

const TAG_GROUPS: { kind: ReleaseTagKind; options: TagOption[] }[] = [
    {
        kind: 'res',
        options: [
            ['2160[pi]', '2160p'],
            ['1080[pi]', '1080p'],
            ['720p', '720p'],
            ['576[pi]', '576p'],
            ['480[pi]', '480p'],
        ],
    },
    { kind: 'hdr', options: [['DV|DoVi|Dolby[. ]?Vision', 'DV']] },
    {
        kind: 'hdr',
        options: [
            ['HDR10\\+|HDR10P(?:lus)?', 'HDR10+'],
            ['HDR10', 'HDR10'],
            ['HDR', 'HDR'],
        ],
    },
    {
        kind: 'plain',
        options: [
            ['(?:BD)?REMUX', 'REMUX'],
            ['Blu-?Ray|BDRip|BRRip', 'BluRay'],
            ['WEB[-. ]?DL', 'WEB-DL'],
            ['WEB[-. ]?Rip', 'WEBRip'],
            ['WEB', 'WEB'],
            ['HDTV', 'HDTV'],
            ['DVDRip', 'DVDRip'],
        ],
    },
    { kind: 'audio', options: [['Atmos', 'Atmos']] },
    {
        kind: 'audio',
        options: [
            ['True-?HD(?:[57]\\.1)?', 'TrueHD'],
            ['DTS-?HD', 'DTS-HD'],
        ],
    },
];

const LABEL_ORDER = TAG_GROUPS.flatMap((group) => group.options.map(([, label]) => label));

const COMPILED = TAG_GROUPS.map((group) => ({
    kind: group.kind,
    options: group.options.map(
        ([pattern, label]) => [new RegExp(`(?<![a-z0-9])(?:${pattern})(?![a-z0-9+])`, 'i'), label] as const,
    ),
}));

export function parseReleaseTags(releaseName: string): ReleaseTag[] {
    const tags: ReleaseTag[] = [];
    for (const group of COMPILED) {
        const match = group.options.find(([pattern]) => pattern.test(releaseName));
        if (match) tags.push({ label: match[1], kind: group.kind });
    }
    return tags;
}

/** Every tag of the given kinds that at least one of the releases carries, best first. */
export function summarizeReleaseTags(releaseNames: string[], kinds: ReleaseTagKind[]): ReleaseTag[] {
    const found = new Map<string, ReleaseTag>();
    for (const tag of releaseNames.flatMap(parseReleaseTags)) {
        if (kinds.includes(tag.kind)) found.set(tag.label, tag);
    }
    return [...found.values()].sort((a, b) => LABEL_ORDER.indexOf(a.label) - LABEL_ORDER.indexOf(b.label));
}
