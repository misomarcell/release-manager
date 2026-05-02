import type { Response } from 'express';
import { z } from 'zod';

// ─── Shared primitive schemas ─────────────────────────────────────────────────
// These mirror the union types in shared/ so validation and TypeScript types
// stay in sync without duplicating the literal values.

/** Matches shared `MediaType = 'movie' | 'tv'` */
export const MediaTypeSchema = z.enum(['movie', 'tv']);

/** Matches shared `FeedbackValue = 'like' | 'dislike'` */
export const FeedbackValueSchema = z.enum(['like', 'dislike']);

/** Positive integer TMDB ID — for JSON body fields (value is already a number). */
export const TmdbIdSchema = z.number().int().positive('TMDB ID must be a positive integer');

/** Positive integer TMDB ID — for query/path params (coerces string → number). */
export const TmdbIdQuerySchema = z.coerce.number().int().positive('TMDB ID must be a positive integer');

// ─── Response helper ──────────────────────────────────────────────────────────

/** Sends a 400 JSON response containing the first Zod validation issue message. */
function sendValidationError(res: Response, error: z.ZodError): void {
    res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid request' });
}

// ─── Inline parsing helpers ───────────────────────────────────────────────────
// Usage inside a handler:
//   const body = parseBody(MySchema, req.body, res);
//   if (!body) return;   // 400 already sent, body is fully typed

type ParseResult<T> = T | null;

/**
 * Validates the request body against `schema`.
 * Returns typed data on success; sends 400 and returns `null` on failure.
 */
export function parseBody<T>(
    schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: z.ZodError } },
    body: unknown,
    res: Response,
): ParseResult<T> {
    const result = schema.safeParse(body);
    if (!result.success) {
        sendValidationError(res, result.error);
        return null;
    }
    return result.data;
}

/**
 * Validates query parameters against `schema`.
 * Returns typed data on success; sends 400 and returns `null` on failure.
 */
export function parseQuery<T>(
    schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: z.ZodError } },
    query: unknown,
    res: Response,
): ParseResult<T> {
    const result = schema.safeParse(query);
    if (!result.success) {
        sendValidationError(res, result.error);
        return null;
    }
    return result.data;
}

/**
 * Validates route parameters against `schema`.
 * Returns typed data on success; sends 400 and returns `null` on failure.
 */
export function parseParams<T>(
    schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: z.ZodError } },
    params: unknown,
    res: Response,
): ParseResult<T> {
    const result = schema.safeParse(params);
    if (!result.success) {
        sendValidationError(res, result.error);
        return null;
    }
    return result.data;
}
