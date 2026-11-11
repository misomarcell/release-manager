import type { MediaStream } from '@rm/shared/jellyfin.models';
import type { ReleaseTag } from '@rm/shared/release-tags';


function bestAudioBadge(streams: MediaStream[]): ReleaseTag | null {
    let best: { priority: number; label: string } | null = null;
    for (const s of streams) {
        if (s.type !== 'audio') continue;
        const codec = s.codec.toLowerCase();
        const spatial = (s.spatialFormat ?? '').toLowerCase();
        let candidate: { priority: number; label: string } | null = null;
        if (codec === 'truehd') candidate = { priority: 5, label: 'TrueHD' };
        else if (spatial === 'dtsx') candidate = { priority: 4, label: 'DTS:X' };
        else if (spatial === 'dolbyatmos' || codec === 'atmos') candidate = { priority: 3, label: 'Atmos' };
        else if (codec === 'dts') {
            const prof = (s.profile ?? '').toUpperCase();
            candidate = prof.includes('MA') ? { priority: 2, label: 'DTS-HD MA' } : { priority: 2, label: 'DTS-HD' };
        } else if (codec === 'eac3') {
            candidate = { priority: 0, label: 'DD+' };
        }
        if (candidate && (!best || candidate.priority > best.priority)) best = candidate;
    }
    return best ? { label: best.label, kind: 'plain' } : null;
}

export function computeMediaBadges(streams: MediaStream[]): ReleaseTag[] {
    const result: ReleaseTag[] = [];
    const video = streams.find((s) => s.type === 'video');

    if (video) {
        const width = video.width ?? 0;
        if (width >= 3840) result.push({ label: '2160p', kind: 'res' });
        else if (width >= 1920) result.push({ label: '1080p', kind: 'res' });
        else if (width >= 1280) result.push({ label: '720p', kind: 'res' });

        const vrt = (video.videoRangeType ?? '').toUpperCase();
        if (vrt.includes('DOVI')) result.push({ label: 'DV', kind: 'hdr' });
        else if (vrt === 'HDR10PLUS') result.push({ label: 'HDR10+', kind: 'hdr' });
        else if (vrt === 'HDR10') result.push({ label: 'HDR10', kind: 'hdr' });
        else if (vrt === 'HDR') result.push({ label: 'HDR', kind: 'hdr' });

        const codec = video.codec.toLowerCase();
        if (codec === 'hevc') result.push({ label: 'HEVC', kind: 'plain' });
        else if (codec === 'av1') result.push({ label: 'AV1', kind: 'plain' });
        else if (codec === 'h264' || codec === 'avc') result.push({ label: 'AVC', kind: 'plain' });
        else if (codec === 'vp9') result.push({ label: 'VP9', kind: 'plain' });
        else if (codec === 'mpeg4') result.push({ label: 'MPEG-4', kind: 'plain' });
    }

    const audioBadge = bestAudioBadge(streams);
    if (audioBadge) result.push(audioBadge);

    return result;
}

export function formatVideoStream(stream: MediaStream): string {
    const parts: string[] = [];
    const w = stream.width ?? 0;
    if (w >= 3840) parts.push('4K UHD');
    else if (w >= 1920) parts.push('1080p');
    else if (w >= 1280) parts.push('720p');
    else if (w > 0) parts.push(`${w}p`);

    if (stream.codec) parts.push(stream.codec.toUpperCase());

    const vrt = (stream.videoRangeType ?? '').toUpperCase();
    if (vrt.includes('DOVI') && stream.videoDoViTitle) {
        parts.push(stream.videoDoViTitle);
    } else if (vrt.includes('DOVI') && vrt.includes('HDR10')) {
        parts.push('Dolby Vision + HDR10' + (vrt.includes('PLUS') ? '+' : ''));
    } else if (vrt.includes('DOVI')) {
        parts.push('Dolby Vision');
    } else if (vrt === 'HDR10PLUS') {
        parts.push('HDR10+');
    } else if (vrt === 'HDR10') {
        parts.push('HDR10');
    } else if (vrt === 'HDR') {
        parts.push('HDR');
    } else if (vrt === 'SDR') {
        parts.push('SDR');
    }

    return parts.join(' · ');
}
