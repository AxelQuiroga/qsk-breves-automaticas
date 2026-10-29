import { load } from "cheerio";
import { ErrorOleFeed } from "./errors.ts";
import type { NoticiaOleCandidata } from "./types.ts";

/** Parseador RSS offline: no realiza peticiones ni depende del estado de Olé. */
export function parsearFeedOle(xml: string): NoticiaOleCandidata[] {
  const contenido = xml.trim();
  if (!contenido || !/^\s*(?:<\?xml\b[^?]*\?>\s*)?<rss\b/i.test(contenido)) {
    throw new ErrorOleFeed("La respuesta no contiene un documento RSS de Olé", "xml-invalido");
  }

  // Cheerio/htmlparser2 es tolerante con XML incompleto; estas comprobaciones
  // estructurales rechazan respuestas truncadas antes de parsearlas.
  const sinCdataNiComentarios = contenido
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  if (!/<\/rss\s*>\s*$/i.test(sinCdataNiComentarios)
    || !/<channel\b/i.test(sinCdataNiComentarios)
    || !/<\/channel\s*>/i.test(sinCdataNiComentarios)
    || (sinCdataNiComentarios.match(/<item\b/gi) ?? []).length !== (sinCdataNiComentarios.match(/<\/item\s*>/gi) ?? []).length) {
    throw new ErrorOleFeed("El XML RSS de Olé está incompleto o no tiene la estructura esperada", "xml-invalido");
  }

  const $ = load(contenido, { xml: true });
  if ($("rss").length !== 1 || $("rss > channel").length !== 1) {
    throw new ErrorOleFeed("El XML no contiene un canal RSS único", "xml-invalido");
  }

  const candidatas: NoticiaOleCandidata[] = [];
  $("rss > channel > item").each((_, item) => {
    const $item = $(item);
    const titulo = limpiar($item.find("title").first().text());
    const url = limpiar($item.find("link").first().text());
    if (!titulo || !url) return;

    const fecha = limpiar($item.find("pubDate").first().text());
    const imagen = limpiar($item.find("enclosure").first().attr("url") ?? "");
    candidatas.push({
      titulo,
      url,
      pubDate: fecha || null,
      imagenUrl: imagen || null,
    });
  });

  if (candidatas.length === 0) {
    throw new ErrorOleFeed("El feed RSS de Olé no contiene noticias utilizables", "feed-vacio");
  }
  return candidatas;
}

function limpiar(valor: string): string {
  return valor.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
