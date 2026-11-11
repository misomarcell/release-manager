import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { extractHttpError } from '../../utils/http-error';

interface RegistrationModel {
    username: string;
}

@Component({
    selector: 'app-login',
    imports: [
        FormField,
        FormRoot,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatExpansionModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class LoginComponent {
    private auth = inject(AuthService);
    private router = inject(Router);

    protected loading = signal(false);
    protected error = signal<string | null>(null);
    protected success = signal<string | null>(null);
    protected registrationModel = signal<RegistrationModel>({ username: '' });
    protected registrationForm = form(this.registrationModel, (path) => required(path.username), {
        submission: { action: () => this.register() },
    });

    protected async login(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);
        this.success.set(null);
        try {
            await this.auth.login();
            this.router.navigate(['/']);
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, 'Login failed'));
        } finally {
            this.loading.set(false);
        }
    }

    private async register(): Promise<void> {
        const username = this.registrationModel().username.trim();
        if (!username) return;

        this.loading.set(true);
        this.error.set(null);
        this.success.set(null);
        try {
            await this.auth.register(username);
            this.success.set('Account created. You can sign in after an administrator has confirmed your account.');
            this.registrationForm().reset({ username: '' });
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, 'Registration failed'));
        } finally {
            this.loading.set(false);
        }
    }
}
