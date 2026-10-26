import { load } from "cheerio";
import type { Noticia } from "../types/noticia.ts";
import { deDiaMesAnioAISO } from "../fechas.ts";
import { normalizarEspacios, resolverUrl, validarUnicaUrl } from "./comunes.ts";

/**
 * Parser del listado de noticias de Lanús, verificado contra
 * https://www.lanus.gob.ar/noticias (CMS propio, 2026-10-22).
 *
 * Estructura de cada tarjeta (evidencia real):
 *
 *   <li><article>
 *     <div class="imagen" ...><div style="background-image:url(https://...jpeg)"></div></div>
 *     <div class="imagen vertical" ...>...misma imagen...</div>
 *     <div class="info">
 *       <div class="categorias">Salud\n21/10/2026</div>   <- categoría + fecha dd/MM/yyyy
 *       <h3>T&#205;TULO</h3>
 *       <div class="resumen texto"> (casi siempre vacío) </div>
 *     </div>
 *     <a href="https://www.lanus.gob.ar/noticias/4625-slug" class="cover"></a>
 *   </article></li>
 *
 * Limitaciones verificadas:
 * - Las URLs de tarjeta son absolutas, SIN slash final. Pedir la variante con
 *   `/` final redirige a http://...:8080/noticias y falla con HTTP 522
 *   (reproducido en la auditoría): pegarse al href del listado es seguro.
 * - `resumen` casi siempre queda vacío -> descripcion: null.
 * - `a.cover` no tiene texto: el dato está en el href.
 */
export function extraerLanus(html: string, urlBase: string): Noticia[] {
  const $ = load(html);
  const vistas = new Set<string>();
  const noticias: Noticia[] = [];

  $("article").each((_, tarjeta) => {
    const $tarjeta = $(tarjeta);

    // Obligatorios: título (h3) y enlace de la portada.
    const titulo = normalizarEspacios($tarjeta.find("h3").first().text());
    const href = $tarjeta.find("a.cover[href]").first().attr("href") ?? "";
    if (!titulo || !href) return;

    const urlNoticia = resolverUrl(href, urlBase);
    if (!validarUnicaUrl(urlNoticia, vistas)) return;

    // Imagen: primer bloque horizontal con background-image inline.
    // (El variante `.imagen.vertical` repite la misma imagen.)
    const estilo =
      $tarjeta
        .find(".imagen")
        .not(".vertical")
        .find("div[style*='background-image']")
        .first()
        .attr("style") ??
      $tarjeta.find("div[style*='background-image']").first().attr("style") ??
      "";
    const match = estilo.match(/url\((['"]?)(.*?)\1\)/);
    const imagenUrl = match?.[2] ? resolverUrl(match[2], urlBase) : null;

    // `.categorias` trae la categoría y la fecha en el mismo texto. La fecha
    // dd/MM/yyyy se saca por regex; la categoría queda como volanta.
    const categorias = normalizarEspacios($tarjeta.find(".categorias").first().text());
    const fecha = deDiaMesAnioAISO(categorias);
    const volanta = normalizarEspacios(categorias.replace(/\d{1,2}\/\d{1,2}\/\d{4}/, "")) || null;

    const descripcion = normalizarEspacios($tarjeta.find(".resumen").first().text()) || null;

    noticias.push({
      titulo,
      descripcion,
      imagenUrl,
      urlNoticia,
      fecha,
      volanta,
      fuente: "lanus",
    });
  });

  return noticias;
}

/**
 * Extrae la bajada de una noticia individual de Lanús.
 *
 * Estructura verificada en páginas reales (2026-10-26):
 *   <h1>TÍTULO</h1>
 *   <div class="texto">
 *     <p>Primer párrafo (bajada/lead)</p>
 *     <p>Resto del cuerpo</p>
 *   </div>
 *
 * Solo se toma el primer párrafo no vacío de `.texto`; nunca el cuerpo completo.
 * Devuelve `null` si no hay texto válido o si repite el título.
 */
export function extraerDescripcionLanus(html: string): string | null {
  const $ = load(html);
  const titulo = normalizarEspacios($("h1").first().text());
  let descripcion = "";
  $(".texto")
    .first()
    .find("p")
    .each((_, elemento) => {
      if (descripcion) return;
      const texto = normalizarEspacios($(elemento).text());
      if (texto) descripcion = texto;
    });
  if (!descripcion || descripcion === titulo) return null;
  return descripcion;
}
