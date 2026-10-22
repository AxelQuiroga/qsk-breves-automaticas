import { completarFuentes } from "./fuentes.ts";
import type { Noticia } from "./types/noticia.ts";

/**
 * Prioriza las noticias recién extraídas y completa con el historial anterior.
 * El listado oficial viene ordenado de más reciente a más antiguo.
 * La URL original identifica cada gacetilla y evita duplicados (regla global:
 * también absorbe contenido sindicado entre fuentes con la misma URL).
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

/**
 * Igual que `verificarHistorialCompleto`, pero POR FUENTE: un registro de
 * Lanús no puede compensar la pérdida de uno de Avellaneda. Los registros
 * que todavía no declaran `fuente` (histórico previo a la migración) se
 * backfilllean por dominio antes de agrupar; un dominio no identificado
 * aborta la verificación (no se arriesga una pérdida por clasificar mal).
 */
export function verificarHistorialCompletoPorFuente(
  resultado: Noticia[],
  anterior: Noticia[],
): void {
  const agrupar = (noticias: Noticia[]) => {
    const porFuente = new Map<string, Noticia[]>();
    for (const noticia of completarFuentes(noticias)) {
      const clave = noticia.fuente;
      const registro = porFuente.get(clave) ?? [];
      registro.push(noticia);
      porFuente.set(clave, registro);
    }
    return porFuente;
  };

  const porFuenteResultado = agrupar(resultado);
  const urlsResultadoPorFuente = new Map(
    [...porFuenteResultado].map(([fuente, registros]) => [
      fuente,
      new Set(registros.map((noticia) => noticia.urlNoticia)),
    ]),
  );

  for (const [fuente, previas] of agrupar(anterior)) {
    const actuales = urlsResultadoPorFuente.get(fuente);
    const perdidas = previas.filter(
      (noticia) => !(actuales?.has(noticia.urlNoticia) ?? false),
    );

    if (perdidas.length > 0) {
      const ejemplo = perdidas[0]?.urlNoticia ?? "(sin URL)";
      throw new Error(
        `El resultado perdería ${perdidas.length} gacetillas de la fuente "${fuente}"` +
          ` (por ejemplo: ${ejemplo}). ` +
          "Se cancela la persistencia para no eliminar registros históricos.",
      );
    }
  }
}
