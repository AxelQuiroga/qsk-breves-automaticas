import { load } from "cheerio";
import type { Noticia } from "../types/noticia.ts";

/**
 * Selectores verificados contra el HTML real de
 * https://www.gba.gob.ar/comunicacion_publica/gacetillas (2026-10-20).
 *
 * Estructura de cada tarjeta ( Drupal 7, vista "org-medios" ):
 *
 *   div#org-medios-page-3.dexp-grid-items
 *     div.node-medios                          <- UNA tarjeta
 *       .field-name-field-volanta-noticia      <- volanta / localidad
 *       .field-name-title > h2 > a             <- título + href (relativo)
 *       .field-name-field-imagen-medios > img  <- imagen (src absoluto en la fuente)
 *       .field-name-field-bajada-noti-agroindustria <- bajada (con entidades HTML)
 */
const SELECTOR_TARJETA = "#org-medios-page-3 div.node-medios";
const SELECTOR_TITULO = ".field-name-title h2 a";
const SELECTOR_VOLANTA = ".field-name-field-volanta-noticia .field-item";
const SELECTOR_IMAGEN = ".field-name-field-imagen-medios img";
const SELECTOR_BAJADA = ".field-name-field-bajada-noti-agroindustria .field-item";

/** Colapsa espacios (incluido NBSP, común en el CMS) y recorta los extremos. */
function normalizarEspacios(texto: string): string {
  return texto.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

/** Resuelve una URL relativa o absoluta contra la URL de la fuente. Devuelve `null` si es inválida. */
function resolverUrl(url: string, base: string): string | null {
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

/**
 * Extrae las tarjetas de noticias del HTML del listado de gacetillas.
 *
 * - No inventa campos: lo ausente se representa como `null`.
 * - Normaliza espacios en todos los textos.
 * - Resuelve URLs relativas (título e imagen) contra `urlBase` usando la API `URL`.
 * - Deduplica por URL absoluta de la noticia.
 * - Devuelve un array vacío si el HTML no contiene el contenedor esperado
 *   (el caller decide si eso es un error de estructura).
 */
export function extraerGacetillas(html: string, urlBase: string): Noticia[] {
  const $ = load(html);
  const urlsVistas = new Set<string>();
  const noticias: Noticia[] = [];

  $(SELECTOR_TARJETA).each((_, elemento) => {
    const tarjeta = $(elemento);

    // Campos obligatorios: sin título o sin enlace la tarjeta se descarta (no se fabrican datos).
    const enlace = tarjeta.find(SELECTOR_TITULO).first();
    const titulo = normalizarEspacios(enlace.text());
    const href = enlace.attr("href");
    if (!titulo || !href) {
      return;
    }

    const urlNoticia = resolverUrl(href, urlBase);
    if (!urlNoticia || urlsVistas.has(urlNoticia)) {
      return;
    }
    urlsVistas.add(urlNoticia);

    // Campos opcionales.
    const srcImagen = tarjeta.find(SELECTOR_IMAGEN).first().attr("src");
    const bajada = normalizarEspacios(tarjeta.find(SELECTOR_BAJADA).first().text());
    const volanta = normalizarEspacios(tarjeta.find(SELECTOR_VOLANTA).first().text());

    noticias.push({
      titulo,
      descripcion: bajada || null,
      imagenUrl: srcImagen ? resolverUrl(srcImagen, urlBase) : null,
      urlNoticia,
      // El listado no muestra fecha en las tarjetas (verificado: 0 campos de fecha en el HTML real).
      fecha: null,
      volanta: volanta || null,
    });
  });

  return noticias;
}
