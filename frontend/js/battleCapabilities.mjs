export function isWebGLAvailable(documentLike = globalThis.document) {
  try {
    if (!documentLike?.createElement) return false;
    const canvas = documentLike.createElement("canvas");
    return Boolean(
      globalThis.WebGL2RenderingContext && canvas.getContext("webgl2") ||
        globalThis.WebGLRenderingContext &&
          (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

export function selectBattleRenderer({ webglAvailable, forceCss = false } = {}) {
  return webglAvailable && !forceCss ? "webgl" : "css";
}
