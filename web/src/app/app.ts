import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateService } from './services/update.service';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';

interface IconDefinition {
    name: string;
    path: string;
}

const ICONS: IconDefinition[] = [
    {
        name: 'imdb',
        path: 'imdb-brands-solid.svg',
    },
    {
        name: 'youtube',
        path: 'youtube-brands-solid.svg',
    },
];

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.html',
})
export class App {
    private iconRegistry = inject(MatIconRegistry);
    private sanitizer = inject(DomSanitizer);

    constructor() {
        inject(UpdateService).init();

        for (const icon of ICONS) {
            this.iconRegistry.addSvgIcon(
                icon.name,
                this.sanitizer.bypassSecurityTrustResourceUrl(`assets/icons/${icon.path}`),
            );
        }
    }
}
