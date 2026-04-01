import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>MovieReleases</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          <div class="actions">
            <button mat-raised-button (click)="login()" [disabled]="loading()">
              <mat-icon>fingerprint</mat-icon>
              Sign in with Passkey
            </button>
            @if (loading()) {
              <mat-spinner diameter="24" />
            }
          </div>
          <details class="register-section">
            <summary>Register a new Passkey</summary>
            <mat-form-field appearance="outline">
              <mat-label>Username</mat-label>
              <input matInput [(ngModel)]="regUsername" />
            </mat-form-field>
            <button mat-stroked-button (click)="register()" [disabled]="loading() || !regUsername">
              <mat-icon>person_add</mat-icon>
              Register
            </button>
          </details>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .login-container {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .login-card {
      max-width: 400px;
      width: 100%;
    }
    .error {
      color: var(--mat-sys-error);
      margin: 0.5rem 0;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1rem 0;
    }
    .register-section {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .register-section summary {
      cursor: pointer;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 1rem;
    }
    .register-section mat-form-field {
      width: 100%;
    }
  `,
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
