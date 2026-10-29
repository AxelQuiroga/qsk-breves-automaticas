import { load } from "cheerio";
import { ErrorOleFeed } from "./errors.ts";
import type { NoticiaOleCandidata, OleNews } from "./types.ts";

const LIMITE_NOTICIAS = 10;
const HOSTS_PERMITIDOS = new Set(["ole.com.ar", "www.ole.com.ar"]);
const PARAMETROS_DE_TRACKING = ["fbclid", "gclid", "mc_cid", "mc_eid"];

/** Valida y normaliza el contenido sin realizar ninguna petición HTTP. */
export function normalizarNoticiasOle(candidatas: NoticiaOleCandidata[]): OleNews[] {
  const resultado: OleNews[] = [];
  const urlsVistas = new Set<string>();

  for (const candidata of candidatas) {
    const title = candidata.titulo.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const url = normalizarUrlOle(candidata.url);
    if (!title || !url || urlsVistas.has(url)) continue;
    urlsVistas.add(url);

    const description = normalizarDescripcion(candidata.description);
    resultado.push({
      id: url,
      title,
      url,
      publishedAt: normalizarFecha(candidata.pubDate),
      imageUrl: candidata.imagenUrl ? normalizarUrlOle(candidata.imagenUrl) : null,
      ...(description ? { description } : {}),
      source: "Olé",
    });
  }

  resultado.sort((a, b) => {
    if (a.publishedAt === null) return b.publishedAt === null ? 0 : 1;
    if (b.publishedAt === null) return -1;
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });

  if (resultado.length === 0) {
    throw new ErrorOleFeed("No quedaron noticias válidas después de normalizar el RSS", "normalizacion");
  }
  return resultado.slice(0, LIMITE_NOTICIAS);
}

function normalizarUrlOle(valor: string): string | null {
  try {
    const url = new URL(valor.trim());
    if (url.protocol !== "https:" || !HOSTS_PERMITIDOS.has(url.hostname.toLowerCase())) return null;
    url.hash = "";
    for (const parametro of [...url.searchParams.keys()]) {
      if (parametro.toLowerCase().startsWith("utm_") || PARAMETROS_DE_TRACKING.includes(parametro.toLowerCase())) {
        url.searchParams.delete(parametro);
      }
    }
    return url.href;
  } catch {
    return null;
  }
}

function normalizarDescripcion(valor: string | null | undefined): string | undefined {
  if (!valor?.trim()) return undefined;
  const texto = load(valor).text().replaceAll("\u00a0", " ").replace(/\s+/g, " ").trim();
  return texto || undefined;
}

function normalizarFecha(valor: string | null): string | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}
