
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "preload": [
      "chunk-YUD2D2KR.js",
      "chunk-Y77OBLLR.js"
    ],
    "route": "/"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-3X46KMNL.js",
      "chunk-Y77OBLLR.js"
    ],
    "route": "/login"
  },
  {
    "renderMode": 1,
    "redirectTo": "/",
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 24829, hash: '755418510166dcad9f4b60a5851b78b333b37b636ced56740cf194d1ab0dabdc', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 17346, hash: '6a919b4dea2a39a43c6bed2eb09fd70f21e315d2efaded1e2ff8c06f12300a99', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-OLB3CZ2S.css': {size: 8042, hash: 'tiSN3FKSrjI', text: () => import('./assets-chunks/styles-OLB3CZ2S_css.mjs').then(m => m.default)}
  },
};
