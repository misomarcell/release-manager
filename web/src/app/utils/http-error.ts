import { HttpErrorResponse } from '@angular/common/http';

export function extractHttpError(e: unknown, fallback: string): string {
    if (e instanceof HttpErrorResponse) return e.error?.error || e.message;
    if (e instanceof Error) return e.message;
    return fallback;
}
