
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 24782, hash: 'eb81bb5ac2d61e3b528e3dccd7d401bc32fb730868957b080e8324d0f7f110cb', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 17299, hash: '9fba840d21eb528b43b5c496aa9af742f9e90b6edf985a4b57992cae933b56a5', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 108898, hash: 'e5183f74428c72cdd897f3fabefe2c745522dba6580f49e9c9c44eb30df24ab8', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'styles-OPUTW5UJ.css': {size: 8043, hash: 'i68XcmjPijU', text: () => import('./assets-chunks/styles-OPUTW5UJ_css.mjs').then(m => m.default)}
  },
};
