import type { Noticia } from "../types/noticia.ts";

/**
 * Utilidades compartidas por los parsers de cada fuente.
 * Copia exacta del comportamiento de `src/extractor/gacetillas.ts` (GBA),
 * que conserva su propia implementación sin cambios para no alterar la
 * extracción en producción.
 */

/** Colapsa espacios (incluido NBSP, común en los CMS) y recorta los extremos. */
export function normalizarEspacios(texto: string): string {
  return texto.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

/** Resuelve una URL relativa o absoluta contra la URL de la fuente. Devuelve `null` si es inválida. */
export function resolverUrl(url: string, base: string): string | null {
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

/** Dedup por URL absoluta dentro de un listado (misma garantía que el parser de GBA). */
export function validarUnicaUrl(
  urlNoticia: string | null,
  vistas: Set<string>,
): urlNoticia is string {
  if (!urlNoticia || vistas.has(urlNoticia)) return false;
  vistas.add(urlNoticia);
  return true;
}

export type { Noticia };