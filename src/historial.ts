import type { Noticia } from "./types/noticia.ts";

/**
 * Prioriza las noticias recién extraídas y completa con el historial anterior.
 * El listado oficial viene ordenado de más reciente a más antiguo.
 * La URL original identifica cada gacetilla y evita duplicados.
 *
 * El historial NO se recorta por defecto: cada registro que entró queda
 * preservado para siempre (el archivo de QSK se genera desde el dataset
 * completo). `limite` es opcional y solo existe para escenarios testing.
 */
export function combinarHistorial(
  nuevas: Noticia[],
  historial: Noticia[],
  limite?: number,
): Noticia[] {
  if (limite !== undefined && (!Number.isInteger(limite) || limite < 1)) {
    throw new Error("El límite debe ser un entero mayor que cero.");
  }

  const resultado: Noticia[] = [];
  const urlsVistas = new Set<string>();

  for (const noticia of [...nuevas, ...historial]) {
    const url = noticia.urlNoticia.trim();
    if (!url || urlsVistas.has(url)) continue;

    urlsVistas.add(url);
    resultado.push(noticia);

    if (typeof limite === "number" && resultado.length === limite) break;
  }

  return resultado;
}

/**
 * Verifica que el historial combinado no haya perdido ninguna gacetilla
 * anterior. Debe ejecutarse ANTES de persistir el resultado; si algo se
 * perdería, lanza y el proceso en curso no toca ningún archivo.
 */
export function verificarHistorialCompleto(
  resultado: Noticia[],
  anterior: Noticia[],
): void {
  const urlsResultado = new Set(resultado.map((noticia) => noticia.urlNoticia));
  const perdidas = anterior.filter((noticia) => !urlsResultado.has(noticia.urlNoticia));

  if (perdidas.length > 0) {
    throw new Error(
      `El resultado perdería ${perdidas.length} gacetillas del historial anterior. ` +
        "Se cancela la persistencia para no eliminar registros históricos.",
    );
  }
}
