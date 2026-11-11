import { Component, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

interface PosterDialogData {
    thumbnailUrl: string;
    fullSizeUrl: string;
    alt: string;
}

@Component({
    selector: 'app-poster-dialog',
    imports: [MatDialogModule],
    templateUrl: './poster-dialog.html',
    styleUrl: './poster-dialog.scss',
})
export class PosterDialogComponent implements OnInit {
    protected data = inject(MAT_DIALOG_DATA) as PosterDialogData;
    protected currentUrl = signal(this.data.thumbnailUrl);

    ngOnInit(): void {
        if (this.data.fullSizeUrl && this.data.fullSizeUrl !== this.data.thumbnailUrl) {
            const img = new Image();
            img.onload = () => this.currentUrl.set(this.data.fullSizeUrl);
            img.src = this.data.fullSizeUrl;
        }
    }
}
