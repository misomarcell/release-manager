import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
    private http = inject(HttpClient);

    get<T>(url: string, params?: HttpParams): Promise<T> {
        return firstValueFrom(this.http.get<T>(url, { params, withCredentials: true }));
    }

    getText(url: string): Promise<string> {
        return firstValueFrom(this.http.get(url, { withCredentials: true, responseType: 'text' }));
    }

    post<T>(url: string, body: unknown = {}, params?: HttpParams): Promise<T> {
        return firstValueFrom(this.http.post<T>(url, body, { params, withCredentials: true }));
    }

    patch<T>(url: string, body: unknown): Promise<T> {
        return firstValueFrom(this.http.patch<T>(url, body, { withCredentials: true }));
    }

    delete<T>(url: string, params?: HttpParams): Promise<T> {
        return firstValueFrom(this.http.delete<T>(url, { withCredentials: true, params }));
    }
}
