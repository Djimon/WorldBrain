// The single most important bench metric (research doc): WebView2 v144+ removed
// the SwiftShader software-WebGL fallback, so on a GPU-less target WebGL2 can
// hard-fail. Detect real GPU vs software vs no-context.

export interface WebglInfo {
  ok: boolean;          // WebGL2 context created at all
  software: boolean;    // context exists but is software-rendered (SwiftShader/llvmpipe)
  renderer: string;
  vendor: string;
}

const SOFTWARE_RE = /swiftshader|llvmpipe|software|basic\s*render|microsoft basic/i;

export function getWebglInfo(): WebglInfo {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
  if (!gl) {
    return { ok: false, software: false, renderer: '(WebGL2 context failed)', vendor: '' };
  }
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg
    ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));
  const vendor = dbg
    ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL))
    : String(gl.getParameter(gl.VENDOR));
  return { ok: true, software: SOFTWARE_RE.test(renderer), renderer, vendor };
}
