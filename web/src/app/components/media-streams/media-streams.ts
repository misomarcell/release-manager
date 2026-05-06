import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import type { MediaStream } from '@rm/shared/jellyfin.models';
import { formatVideoStream } from '../../utils/media-badges';

interface MediaInfoGroup {
    label: string;
    icon: string;
    items: string[];
}

interface FileInfo {
    sizeBytes: number | null;
    path: string | null;
}

@Component({
    selector: 'app-media-streams',
    imports: [MatIconModule, MatExpansionModule],
    templateUrl: './media-streams.html',
    styleUrls: ['./media-streams.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaStreamsComponent {
    streams = input.required<MediaStream[]>();
    fileInfo = input.required<FileInfo>();

    protected groups = computed((): MediaInfoGroup[] => {
        const result: MediaInfoGroup[] = [];

        const fileInfo = this.fileInfo();
        if (fileInfo.path) {
            const filename = fileInfo.path.split(/[/\\]/).pop() ?? fileInfo.path;
            result.push({ label: 'File Name', icon: 'description', items: [filename] });
        }

        if (fileInfo.sizeBytes) {
            const sizeGb = (fileInfo.sizeBytes / 1_073_741_824).toFixed(2);
            result.push({ label: 'File Size', icon: 'storage', items: [`${sizeGb} GB`] });
        }

        const streams = this.streams();
        const video = streams.filter((s) => s.type === 'video');
        if (video.length) {
            result.push({ label: 'Video Tracks', icon: 'videocam', items: video.map(formatVideoStream) });
        }

        const audio = streams.filter((s) => s.type === 'audio');
        if (audio.length) {
            result.push({ label: 'Audio Tracks', icon: 'volume_up', items: audio.map((s) => s.displayTitle) });
        }

        const subs = streams.filter((s) => s.type === 'subtitle');
        if (subs.length) {
            result.push({ label: 'Subtitles', icon: 'subtitles', items: subs.map((s) => s.displayTitle) });
        }

        return result;
    });
}
