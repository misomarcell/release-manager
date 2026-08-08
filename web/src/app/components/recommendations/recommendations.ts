import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-recommendations',
    imports: [RouterLink, RouterLinkActive, RouterOutlet, MatButtonModule, MatIconModule],
    templateUrl: './recommendations.html',
    styleUrl: './recommendations.scss',
})
export class RecommendationsComponent {}
