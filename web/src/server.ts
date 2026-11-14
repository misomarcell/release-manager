import {
    AngularNodeAppEngine,
    createNodeRequestHandler,
    isMainModule,
    writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { isIP } from 'node:net';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:3000';
const SKIPPED_RESPONSE_HEADERS = new Set([
    'connection',
    'keep-alive',
    'transfer-encoding',
    'content-encoding',
    'content-length',
    'set-cookie',
]);

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use('/api', express.raw({ type: '*/*' }), async (req, res) => {
    try {
        const url = new URL(req.originalUrl, backendUrl);
        const headers: Record<string, string> = {};
        const contentType = getHeader(req.headers['content-type']);
        const cookie = getHeader(req.headers['cookie']);
        const userAgent = getHeader(req.headers['user-agent']);
        const clientIp = resolveClientIp(req);

        if (contentType) headers['content-type'] = contentType;
        if (cookie) headers['cookie'] = cookie;
        if (userAgent) headers['user-agent'] = userAgent;
        if (clientIp) headers['x-forwarded-for'] = clientIp;

        const upstream = await fetch(url, {
            method: req.method,
            headers,
            body: Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : undefined,
        });
        res.status(upstream.status);

        for (const [key, value] of upstream.headers.entries()) {
            if (SKIPPED_RESPONSE_HEADERS.has(key)) continue;
            res.setHeader(key, value);
        }
        const setCookies = upstream.headers.getSetCookie();
        if (setCookies.length > 0) {
            res.setHeader('set-cookie', setCookies);
        }

        const body = await upstream.arrayBuffer();
        res.end(Buffer.from(body));
    } catch {
        res.status(502).json({ error: 'Backend unavailable' });
    }
});

app.use(
    express.static(browserDistFolder, {
        maxAge: '1y',
        index: false,
        redirect: false,
    }),
);

app.use((req, res, next) => {
    angularApp
        .handle(req)
        .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
        .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
    const port = process.env['PORT'] || 4000;
    app.listen(port, () => {
        console.log(`Frontend server listening on http://localhost:${port}`);
    });
}

export const reqHandler = createNodeRequestHandler(app);

function getHeader(header: string | string[] | undefined): string | undefined {
    return Array.isArray(header) ? header[0] : header;
}

function resolveClientIp(req: express.Request): string | undefined {
    const cfIp = getHeader(req.headers['cf-connecting-ip'])?.trim();
    return normalizeIp(cfIp && isIP(cfIp) ? cfIp : req.socket.remoteAddress);
}

function normalizeIp(ip: string | undefined): string | undefined {
    const ipv4MappedPrefix = '::ffff:';
    if (!ip) return undefined;
    return ip.toLowerCase().startsWith(ipv4MappedPrefix) ? ip.slice(ipv4MappedPrefix.length) : ip;
}
