import { load } from "cheerio";
import type { Noticia } from "../types/noticia.ts";
import { normalizarEspacios, resolverUrl, validarUnicaUrl } from "./comunes.ts";

/**
 * Parser del archive de noticias de Avellaneda, verificado contra
 * https://www.mda.gob.ar/noticias/ (WordPress 6.1.1, CPT `noticias`, 2026-10-22).
 *
 * Estructura de cada tarjeta (evidencia real):
 *
 *   <li><a class="noticias-caja" href="https://www.mda.gob.ar/noticias/slug/">
 *     <img class="img-fluid wp-post-image" src="https://www.mda.gob.ar/wp-content/uploads/..." />
 *     <div class="noticias-caja-texto">
 *       <div class="home-noticias-caja-categoria"> (vacía en el archive) </div>
 *       <div class="home-noticias-caja-titulo">Título</div>
 *       <div class="home-noticias-caja-fecha">Mié 21 Oct 2026</div>
 *     </div>
 *   </a></li>
 *
 * Limitaciones verificadas:
 * - El feed RSS de /noticias/feed/ trae UN solo item y la API REST no expone
 *   el CPT (/wp-json/wp/v2/noticias -> 404): el archive HTML es la única vía.
 * - `home-noticias-caja-descripcion` no existe: descripcion null.
 * - La fecha es día-abreviado + número + mes-abreviado + año
 *   ("Mié 21 Oct 2026"): día de la semana ignorado; el mes necesita mapa.
 * - El archive mezcla ~60 tarjetas por página (posibles cards estáticas de
 *   portada): dedup por URL en este parser y el porte a 12 lo limita.
 */
const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** "Mié 21 Oct 2026" -> "2026-10-21". Devuelve `null` cuando no se puede parsear. */
export function parsearFechaAvellaneda(texto: string | null): string | null {
  if (!texto) return null;
  const match = texto.match(/(\d{1,2})\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]{3,10})\.?\s+(\d{4})/);
  const diaTexto = match?.[1];
  const mesTexto = match?.[2];
  const anio = match?.[3];
  if (!diaTexto || !mesTexto || !anio) return null;
  const mes = MESES[mesTexto.slice(0, 3).toLowerCase()];
  if (mes === undefined) return null;
  const dia = Number.parseInt(diaTexto, 10);
  if (dia < 1 || dia > 31) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function extraerAvellaneda(html: string, urlBase: string): Noticia[] {
  const $ = load(html);
  const vistas = new Set<string>();
  const noticias: Noticia[] = [];

  $("a.noticias-caja[href]").each((_, tarjeta) => {
    const $tarjeta = $(tarjeta);

    // Obligatorio: título del bloque de texto y enlace de la tarjeta.
    const titulo = normalizarEspacios($tarjeta.find(".home-noticias-caja-titulo").first().text());
    const href = $tarjeta.attr("href") ?? "";
    if (!titulo || !href) return;

    const urlNoticia = resolverUrl(href, urlBase);
    if (!validarUnicaUrl(urlNoticia, vistas)) return;

    // Opcionales.
    const fecha = parsearFechaAvellaneda(
      normalizarEspacios($tarjeta.find(".home-noticias-caja-fecha").first().text()),
    );
    const volanta =
      normalizarEspacios($tarjeta.find(".home-noticias-caja-categoria").first().text()) || null;
    const src = $tarjeta.find("img").first().attr("src") ?? "";
    const imagenUrl = src && !src.startsWith("data:") ? resolverUrl(src, urlBase) : null;

    noticias.push({
      titulo,
      descripcion: null,
      imagenUrl,
      urlNoticia,
      fecha,
      volanta,
      fuente: "avellaneda",
    });
  });

  return noticias;
}

/**
 * Extrae la bajada de una noticia individual de Avellaneda.
 *
 * Estructura verificada en páginas reales (2026-10-26):
 *   <h1 class="pt-4">TÍTULO</h1>
 *   <h2 class="pt-4">Bajada breve</h2>
 *
 * Solo se toma el texto del primer `h2`; nunca el cuerpo completo.
 * Devuelve `null` si no hay texto válido o si repite el título.
 */
export function extraerDescripcionAvellaneda(html: string): string | null {
  const $ = load(html);
  const titulo = normalizarEspacios($("h1").first().text());
  const descripcion = normalizarEspacios($("h2").first().text());
  if (!descripcion || descripcion === titulo) return null;
  return descripcion;
}
