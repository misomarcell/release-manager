import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  username = signal<string | null>(null);

  async checkSession(): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ username: string }>('/api/auth/me', { withCredentials: true }),
      );
      this.username.set(result.username);
      return true;
    } catch {
      this.username.set(null);
      return false;
    }
  }

  async register(username: string): Promise<void> {
    const options = await firstValueFrom(
      this.http.post<PublicKeyCredentialCreationOptionsJSON>(
        '/api/auth/register/start',
        { username },
        { withCredentials: true },
      ),
    );

    const response = await startRegistration({ optionsJSON: options });

    await firstValueFrom(
      this.http.post(
        '/api/auth/register/finish',
        { username, response },
        { withCredentials: true },
      ),
    );
  }

  async login(): Promise<void> {
    const options = await firstValueFrom(
      this.http.post<PublicKeyCredentialRequestOptionsJSON>(
        '/api/auth/login/start',
        {},
        { withCredentials: true },
      ),
    );

    const response = await startAuthentication({ optionsJSON: options });

    const result = await firstValueFrom(
      this.http.post<{ username: string }>(
        '/api/auth/login/finish',
        { response },
        { withCredentials: true },
      ),
    );
    this.username.set(result.username);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}, { withCredentials: true }));
    this.username.set(null);
  }
}
