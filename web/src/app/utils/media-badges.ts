import type { MediaStream } from '@rm/shared/jellyfin.models';

export interface Badge {
    label: string;
    cls: string;
}

function bestAudioBadge(streams: MediaStream[]): Badge | null {
    let best: { priority: number; label: string } | null = null;
    for (const s of streams) {
        if (s.type !== 'audio') continue;
        const codec = s.codec.toLowerCase();
        const spatial = (s.spatialFormat ?? '').toLowerCase();
        let candidate: { priority: number; label: string } | null = null;
        if (codec === 'truehd') candidate = { priority: 5, label: 'TrueHD' };
        else if (spatial === 'dtsx') candidate = { priority: 4, label: 'DTS:X' };
        else if (spatial === 'dolbyatmos') candidate = { priority: 3, label: 'Atmos' };
        else if (codec === 'dts') {
            const prof = (s.profile ?? '').toUpperCase();
            candidate = prof.includes('MA') ? { priority: 2, label: 'DTS-HD MA' } : { priority: 2, label: 'DTS-HD' };
        } else if (codec === 'eac3') {
            candidate = { priority: 0, label: 'DD+' };
        }
        if (candidate && (!best || candidate.priority > best.priority)) best = candidate;
    }
    return best ? { label: best.label, cls: 'badge-audio' } : null;
}

export function computeMediaBadges(streams: MediaStream[]): Badge[] {
    const result: Badge[] = [];
    const video = streams.find((s) => s.type === 'video');

    if (video) {
        if ((video.width ?? 0) >= 3840) result.push({ label: '4K', cls: 'badge-4k' });

        const vrt = (video.videoRangeType ?? '').toUpperCase();
        if (vrt.includes('DOVI')) result.push({ label: 'DoVi', cls: 'badge-dv' });
        else if (vrt === 'HDR10PLUS') result.push({ label: 'HDR10+', cls: 'badge-hdr' });
        else if (vrt === 'HDR10') result.push({ label: 'HDR10', cls: 'badge-hdr' });
        else if (vrt === 'HDR') result.push({ label: 'HDR', cls: 'badge-hdr' });

        const codec = video.codec.toLowerCase();
        if (codec === 'hevc') result.push({ label: 'HEVC', cls: 'badge-codec' });
        else if (codec === 'av1') result.push({ label: 'AV1', cls: 'badge-codec' });
    }

    const audioBadge = bestAudioBadge(streams);
    if (audioBadge) result.push(audioBadge);

    return result;
}
