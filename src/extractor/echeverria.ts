import { load } from "cheerio";
import type { Noticia } from "../types/noticia.ts";
import { aFechaISOLocal } from "../fechas.ts";
import { normalizarEspacios, resolverUrl, validarUnicaUrl } from "./comunes.ts";

/**
 * Parser del feed RSS oficial de Esteban Echeverría, verificado contra
 * https://www.estebanecheverria.gob.ar/feed/ (WordPress 6.8.11, 2026-10-22).
 *
 * Estructura de cada <item> (evidencia real):
 *
 *   <item>
 *     <title>NUEVOS TRABAJOS DE BACHEO...</title>
 *     <link>https://www.estebanecheverria.gob.ar/slug/</link>   <- texto plano
 *     <pubDate>Tue, 20 Oct 2026 13:37:17 +0000</pubDate>        <- fecha explícita (UTC)
 *     <description><![CDATA[ resumen ]]></description>
 *     <guid isPermaLink="false">https://.../?p=135855</guid>
 *     <category>...</category>   <- varias, demasiado ruidosas para volanta
 *
 * Limitaciones verificadas:
 * - El feed NO trae imágenes (0 <enclosure>), el artículo tampoco tiene
 *   <og:image> ni <wp-post-image>: decisions aprobada -> imagenUrl: null.
 * - <description> es el resumen oficial; <content:encoded> no se usa.
 * - La fecha es RFC-822 con hora en UTC: se convierte a fecha local de
 *   la fuente (America/Argentina/Buenos_Aires) mediante `aFechaISOLocal`.
 */
export function extraerEstebanEcheverria(xml: string, urlBase: string): Noticia[] {
  const $ = load(xml, { xml: true });
  const vistas = new Set<string>();
  const noticias: Noticia[] = [];

  $("item").each((_, item) => {
    const $item = $(item);

    // Obligatorios: sin título o sin enlace el item se descarta.
    const titulo = normalizarEspacios($item.find("title").first().text());
    const href = normalizarEspacios($item.find("link").first().text());
    if (!titulo || !href) return;

    const urlNoticia = resolverUrl(href, urlBase);
    if (!validarUnicaUrl(urlNoticia, vistas)) return;

    // Opcionales.
    const descripcion = normalizarEspacios($item.find("description").first().text()) || null;
    const fecha = aFechaISOLocal($item.find("pubDate").first().text() || null);

    noticias.push({
      titulo,
      descripcion,
      imagenUrl: null,
      urlNoticia,
      fecha,
      volanta: null,
      fuente: "esteban-echeverria",
    });
  });

  return noticias;
}
