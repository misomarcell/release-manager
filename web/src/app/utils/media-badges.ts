import type { MediaStream } from '@rm/shared/jellyfin.models';
import type { ReleaseTag } from '@rm/shared/release-tags';

const RESOLUTIONS: [minWidth: number, label: string][] = [
    [3840, '2160p'],
    [1920, '1080p'],
    [1280, '720p'],
];

const HDR_LABELS = new Map([
    ['HDR10PLUS', 'HDR10+'],
    ['HDR10', 'HDR10'],
    ['HDR', 'HDR'],
]);

const VIDEO_CODEC_LABELS = new Map([
    ['hevc', 'HEVC'],
    ['av1', 'AV1'],
    ['h264', 'AVC'],
    ['avc', 'AVC'],
    ['vp9', 'VP9'],
    ['mpeg4', 'MPEG-4'],
]);

interface AudioBadge {
    priority: number;
    label: string;
}

function resolutionLabel(width: number): string | undefined {
    return RESOLUTIONS.find(([minWidth]) => width >= minWidth)?.[1];
}

function audioBadge(stream: MediaStream): AudioBadge | null {
    const codec = stream.codec.toLowerCase();
    const spatial = (stream.spatialFormat ?? '').toLowerCase();
    if (codec === 'truehd') return { priority: 5, label: 'TrueHD' };
    if (spatial === 'dtsx') return { priority: 4, label: 'DTS:X' };
    if (spatial === 'dolbyatmos' || codec === 'atmos') return { priority: 3, label: 'Atmos' };
    if (codec === 'dts') {
        const lossless = (stream.profile ?? '').toUpperCase().includes('MA');
        return { priority: 2, label: lossless ? 'DTS-HD MA' : 'DTS-HD' };
    }
    if (codec === 'eac3') return { priority: 0, label: 'DD+' };
    return null;
}

function bestAudioBadge(streams: MediaStream[]): ReleaseTag | null {
    let best: AudioBadge | null = null;
    for (const stream of streams) {
        if (stream.type !== 'audio') continue;
        const candidate = audioBadge(stream);
        if (candidate && (!best || candidate.priority > best.priority)) best = candidate;
    }
    return best ? { label: best.label, kind: 'plain' } : null;
}

function videoBadges(video: MediaStream): ReleaseTag[] {
    const range = (video.videoRangeType ?? '').toUpperCase();
    const badges: (ReleaseTag | null)[] = [
        tag(resolutionLabel(video.width ?? 0), 'res'),
        tag(range.includes('DOVI') ? 'DV' : HDR_LABELS.get(range), 'hdr'),
        tag(VIDEO_CODEC_LABELS.get(video.codec.toLowerCase()), 'plain'),
    ];
    return badges.filter((badge) => badge !== null);
}

function tag(label: string | undefined, kind: ReleaseTag['kind']): ReleaseTag | null {
    return label ? { label, kind } : null;
}

export function computeMediaBadges(streams: MediaStream[]): ReleaseTag[] {
    const video = streams.find((s) => s.type === 'video');
    const audio = bestAudioBadge(streams);
    return [...(video ? videoBadges(video) : []), ...(audio ? [audio] : [])];
}

function dynamicRangeLabel(stream: MediaStream): string | undefined {
    const range = (stream.videoRangeType ?? '').toUpperCase();
    if (range === 'SDR') return 'SDR';
    if (!range.includes('DOVI')) return HDR_LABELS.get(range);
    if (stream.videoDoViTitle) return stream.videoDoViTitle;
    if (!range.includes('HDR10')) return 'Dolby Vision';
    return range.includes('PLUS') ? 'Dolby Vision + HDR10+' : 'Dolby Vision + HDR10';
}

function resolutionText(width: number): string {
    if (width >= 3840) return '4K UHD';
    return resolutionLabel(width) ?? (width > 0 ? `${width}p` : '');
}

export function formatVideoStream(stream: MediaStream): string {
    return [resolutionText(stream.width ?? 0), stream.codec.toUpperCase(), dynamicRangeLabel(stream)]
        .filter(Boolean)
        .join(' · ');
}
