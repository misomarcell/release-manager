import { Component, computed, input } from '@angular/core';
import type { MediaStream } from '@rm/shared/jellyfin.models';
import { formatVideoStream } from '../../utils/media-badges';
import { formatBytes } from '../../utils/format-bytes';

interface MediaInfoRow {
    label: string;
    value: string;
    mono?: boolean;
}

@Component({
    selector: 'app-media-streams',
    templateUrl: './media-streams.html',
    styleUrl: './media-streams.scss',
})
export class MediaStreamsComponent {
    streams = input.required<MediaStream[]>();
    sizeBytes = input<number | null>(null);
    path = input<string | null>(null);

    protected rows = computed(() => {
        const streams = this.streams();
        const titles = (type: MediaStream['type']) =>
            streams
                .filter((stream) => stream.type === type)
                .map((stream) => (type === 'video' ? formatVideoStream(stream) : stream.displayTitle))
                .join(' · ');
        const size = this.sizeBytes();
        const rows: MediaInfoRow[] = [
            { label: 'Video', value: titles('video') },
            { label: 'Audio', value: titles('audio') },
            { label: 'Subtitles', value: titles('subtitle') },
            { label: 'Size', value: size ? formatBytes(size) : '' },
            { label: 'Path', value: this.path() ?? '', mono: true },
        ];
        return rows.filter((row) => row.value);
    });
}
