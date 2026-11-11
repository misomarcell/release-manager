import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { VersionService } from '../../services/version.service';

@Component({
    selector: 'app-account-menu',
    imports: [DatePipe, RouterLink, MatDividerModule, MatIconModule, MatMenuModule],
    templateUrl: './account-menu.html',
    styleUrl: './account-menu.scss',
})
export class AccountMenuComponent {
    private router = inject(Router);
    protected auth = inject(AuthService);
    protected version = inject(VersionService);
    protected initial = computed(() => this.auth.username()?.charAt(0).toUpperCase() ?? '');

    protected async logout(): Promise<void> {
        await this.auth.logout();
        void this.router.navigate(['/login']);
    }
}
