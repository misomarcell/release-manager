
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "preload": [
      "chunk-EQIHRPJK.js",
      "chunk-DFQI3FKN.js"
    ],
    "route": "/"
  },
  {
    "renderMode": 1,
    "preload": [
      "chunk-3WIJYF7M.js",
      "chunk-DFQI3FKN.js"
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
    'index.csr.html': {size: 24829, hash: 'd24df7ee209295da45eabab3207da123a317d5fb4cd4afeefca176551aec1285', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 17346, hash: '38a8bdf57ee2b9532c813b42734fd0e82721f56dceef25dcb59db130dc148c1c', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-OLB3CZ2S.css': {size: 8042, hash: 'tiSN3FKSrjI', text: () => import('./assets-chunks/styles-OLB3CZ2S_css.mjs').then(m => m.default)}
  },
};
