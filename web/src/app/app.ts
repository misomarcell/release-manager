import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { UpdateService } from './services/update.service';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.html',
})
export class App {
    constructor() {
        inject(UpdateService).init();
        inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-rounded');
    }
}
