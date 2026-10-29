import type { OleNews } from "./types.ts";

const TRACKING = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;

/** URL canónica usada únicamente para deduplicar, sin modificar la URL publicada. */
export function canonicalizarUrlOle(valor: string): string {
  try {
    const url = new URL(valor);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return valor.trim();
  }
}

/**
 * Combina el historial append-only con la extracción reciente.
 * Las noticias existentes conservan su URL/identidad; los metadatos más nuevos
 * actualizan el registro. El resultado no depende del orden de entrada.
 */
export function combinarHistorialOle(
  historial: readonly OleNews[],
  recientes: readonly OleNews[],
): OleNews[] {
  const porUrl = new Map<string, OleNews>();
  for (const noticia of [...historial, ...recientes]) {
    const clave = canonicalizarUrlOle(noticia.url);
    const anterior = porUrl.get(clave);
    if (!anterior) {
      porUrl.set(clave, noticia);
      continue;
    }

    const { description: descripcionNueva, ...metadatosRecientes } = noticia;
    const descripcion = descripcionNueva?.trim() || anterior.description?.trim();
    porUrl.set(clave, {
      ...anterior,
      ...metadatosRecientes,
      ...(descripcion ? { description: descripcion } : {}),
      id: anterior.id || noticia.id,
    });
  }

  return [...porUrl.values()].sort((a, b) => {
    if (a.publishedAt === null && b.publishedAt !== null) return 1;
    if (a.publishedAt !== null && b.publishedAt === null) return -1;
    if (a.publishedAt && b.publishedAt && a.publishedAt !== b.publishedAt) {
      return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    }
    return a.url.localeCompare(b.url);
  });
}
