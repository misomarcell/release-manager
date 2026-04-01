import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');
const backendUrl = process.env['BACKEND_URL'] || 'http://localhost:3000';

const app = express();
const angularApp = new AngularNodeAppEngine();

// Proxy API requests to the backend service
app.use('/api', async (req, res) => {
  try {
    const url = new URL(req.originalUrl, backendUrl);
    const headers: Record<string, string> = {};
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'] as string;
    }
    if (req.headers['cookie']) {
      headers['cookie'] = req.headers['cookie'] as string;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk as ArrayBuffer));
      }
      fetchOptions.body = Buffer.concat(chunks).toString('utf-8');
    }

    const upstream = await fetch(url, fetchOptions);
    res.status(upstream.status);

    for (const [key, value] of upstream.headers.entries()) {
      if (key === 'set-cookie') continue;
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

export default createNodeRequestHandler(app);

export const reqHandler = createNodeRequestHandler(app);
