import type { Noticia } from "./types/noticia.ts";

/**
 * Prioriza las noticias recién extraídas y completa con el historial anterior.
 * El listado oficial viene ordenado de más reciente a más antiguo.
 * La URL original identifica cada gacetilla y evita duplicados.
 */
export function combinarHistorial(
  nuevas: Noticia[],
  historial: Noticia[],
  limite = 12,
): Noticia[] {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error("El límite debe ser un entero mayor que cero.");
  }

  const resultado: Noticia[] = [];
  const urlsVistas = new Set<string>();

  for (const noticia of [...nuevas, ...historial]) {
    const url = noticia.urlNoticia.trim();
    if (!url || urlsVistas.has(url)) continue;

    urlsVistas.add(url);
    resultado.push(noticia);

    if (resultado.length === limite) break;
  }

  return resultado;
}
