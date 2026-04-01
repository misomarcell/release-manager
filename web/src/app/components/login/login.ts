import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected regUsername = '';

  protected async login(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login();
      this.router.navigate(['/']);
    } catch (e: unknown) {
      this.error.set(this.extractError(e, 'Login failed'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async register(): Promise<void> {
    if (!this.regUsername.trim()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.register(this.regUsername.trim());
      this.error.set(null);
      alert(
        'Passkey registered! Ask an admin to activate your account in the database (valid=true).',
      );
    } catch (e: unknown) {
      this.error.set(this.extractError(e, 'Registration failed'));
    } finally {
      this.loading.set(false);
    }
  }

  private extractError(e: unknown, fallback: string): string {
    if (e instanceof HttpErrorResponse) return e.error?.error || e.message;
    if (e instanceof Error) return e.message;
    return fallback;
  }
}
