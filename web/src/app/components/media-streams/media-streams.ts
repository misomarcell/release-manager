import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { MediaStream } from '@rm/shared/jellyfin.models';
import { formatVideoStream } from '../../utils/media-badges';

interface StreamGroup {
    label: string;
    icon: string;
    items: string[];
}

@Component({
    selector: 'app-media-streams',
    imports: [MatIconModule],
    templateUrl: './media-streams.html',
    styleUrl: './media-streams.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaStreamsComponent {
    streams = input.required<MediaStream[]>();

    protected groups = computed((): StreamGroup[] => {
        const all = this.streams();
        const result: StreamGroup[] = [];

        const video = all.filter((s) => s.type === 'video');
        if (video.length) {
            result.push({ label: 'Video', icon: 'videocam', items: video.map(formatVideoStream) });
        }

        const audio = all.filter((s) => s.type === 'audio');
        if (audio.length) {
            result.push({ label: 'Audio', icon: 'volume_up', items: audio.map((s) => s.displayTitle) });
        }

        const subs = all.filter((s) => s.type === 'subtitle');
        if (subs.length) {
            result.push({ label: 'Subtitles', icon: 'subtitles', items: subs.map((s) => s.displayTitle) });
        }

        return result;
    });
}
