import type { Response } from 'express';
import { z } from 'zod';

export const MediaTypeSchema = z.enum(['movie', 'tv']);

export const FeedbackValueSchema = z.enum(['like', 'dislike']);

export const TmdbIdSchema = z.number().int().positive('TMDB ID must be a positive integer');

export const TmdbIdQuerySchema = z.coerce.number().int().positive('TMDB ID must be a positive integer');

/** Returns the parsed input, or answers 400 with the first validation message and returns `null`. */
function parseRequest<T>(schema: z.ZodType<T>, input: unknown, res: Response): T | null {
    const result = schema.safeParse(input);
    if (!result.success) {
        res.status(400).json({ error: result.error.issues[0]?.message ?? 'Invalid request' });
        return null;
    }
    return result.data;
}

export const parseBody = parseRequest;
export const parseQuery = parseRequest;
export const parseParams = parseRequest;
