import type { Noticia } from "../types/noticia.ts";
import { descargarConReintentos, type OpcionesDescarga } from "../red.ts";

/**
 * Completa `descripcion` de noticias que no la traen en el listado, descargando
 * la página individual una sola vez por URL (cache en memoria) y parseando con
 * la función específica de cada fuente.
 *
 * Los fallos HTTP/parseo no interrumpen la corrida: la noticia conserva su
 * `descripcion` previa (normalmente `null`).
 */
export async function enriquecerDescripciones(
  noticias: Noticia[],
  extraerDescripcion: (html: string) => string | null,
  opciones: OpcionesDescarga = {},
): Promise<Noticia[]> {
  const cache = new Map<string, string | null>();
  const resultado: Noticia[] = [];

  for (const noticia of noticias) {
    if (noticia.descripcion) {
      resultado.push(noticia);
      continue;
    }

    let descripcion = cache.get(noticia.urlNoticia);
    if (descripcion === undefined) {
      try {
        const { html } = await descargarConReintentos(noticia.urlNoticia, {
          ...opciones,
          tiposAceptados: opciones.tiposAceptados ?? ["text/html"],
        });
        descripcion = extraerDescripcion(html);
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        console.warn(`[descripcion] No se pudo obtener descripcion de ${noticia.urlNoticia}: ${mensaje}`);
        descripcion = null;
      }
      cache.set(noticia.urlNoticia, descripcion);
    }

    resultado.push(descripcion ? { ...noticia, descripcion } : noticia);
  }

  return resultado;
}