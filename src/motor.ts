import type { Noticia } from "./types/noticia.ts";
import { FUENTES } from "./listado-fuentes.ts";
import { LIMITE_POR_FUENTE, type FuenteEjecutable } from "./fuentes.ts";
import { descargarConReintentos, ErrorExtraccion, type CategoriaError, type OpcionesDescarga } from "./red.ts";

/**
 * Motor de extracción multi-fuente.
 *
 * Por cada fuente: descarga (con reintentos acotados) -> parser -> guard
 * anti HTML-cambiado (HTTP OK con 0 items = error estructural, NO es un
 * resultado vacío válido) -> recorte a `LIMITE_POR_FUENTE` (12) más
 * recientes. Una fuente fallida queda marcada y NO aporta noticias;
 * nunca invalida la extracción de las demás.
 *
 * El motor NO toca el filesystem: recibe el historial (para calcular
 * "nuevas reales") y devuelve la corrida. La persistencia, el merge con
 * el historial y los guard anti-pérdida viven en `index.ts`, así los
 * tests del motor no necesitan disco ni estado.
 */

export interface EstadoFuente {
  id: string;
  nombre: string;
  estado: "ok" | "error";
  /** Notas recibidas del listado (antes del recorte a 12). Solo si `estado: "ok"`. */
  extraidas: number;
  /** Notas del listado cuya URL no está en el historial (novedades reales). */
  nuevasReales: number;
  /** Solo si `estado: "error"`: causa raíz por categorías de `src/red.ts`. */
  categoriaError?: CategoriaError;
  mensajeError?: string;
}

export type EstadoCorrida = "ok" | "parcial" | "falla-total";

export interface ResultadoCorrida {
  estado: EstadoCorrida;
  /** Exit code propuesto para el proceso: 0 ok, 2 parcial, 1 falla total. */
  exitCode: 0 | 1 | 2;
  fuentes: EstadoFuente[];
  /** Novedades de las fuentes sanas, ya cortadas a 12 por fuente, en orden de registro. */
  nuevas: Noticia[];
}

export interface OpcionesCorrida {
  /** Historial persistido; sirve para contar novedades reales por fuente. */
  historial?: Noticia[];
  /** Por defecto el registro completo de `src/fuentes.ts`. */
  fuentes?: FuenteEjecutable[];
  /** Inyectables para tests (por defecto los reales de `src/red.ts`). */
  fetchFn?: typeof fetch;
  dormir?: (ms: number) => Promise<void>;
  intentos?: number;
  timeoutMs?: number;
}

export async function correrExtraccion(
  opciones: OpcionesCorrida = {},
): Promise<ResultadoCorrida> {
  const fuentes = opciones.fuentes ?? FUENTES;
  const historial = opciones.historial ?? [];
  const urlsHistorial = new Set(historial.map((noticia) => noticia.urlNoticia.trim()));

  const estados: EstadoFuente[] = [];
  const nuevas: Noticia[] = [];

  for (const fuente of fuentes) {
    const estadoFuente: EstadoFuente = {
      id: fuente.id,
      nombre: fuente.nombre,
      estado: "ok",
      extraidas: 0,
      nuevasReales: 0,
    };

    try {
      const { html, urlBase } = await descargarConReintentos(fuente.listarUrl, {
        tiposAceptados: fuente.tiposAceptados,
        fetchFn: opciones.fetchFn,
        dormir: opciones.dormir,
        intentos: opciones.intentos,
        timeoutMs: opciones.timeoutMs,
      });

      let extras: Noticia[];
      try {
        extras = fuente.extraer(html, urlBase);
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        throw new ErrorExtraccion(`El parser de ${fuente.nombre} falló: ${mensaje}`, "parser");
      }

      if (extras.length === 0) {
        throw new ErrorExtraccion(
          `${fuente.listarUrl} respondió OK pero devolvió 0 notas (posible cambio de HTML o del feed).`,
          "estructural",
        );
      }

      const recortadas = extras.slice(0, LIMITE_POR_FUENTE);
      nuevas.push(...recortadas);
      estadoFuente.extraidas = extras.length;
      estadoFuente.nuevasReales = recortadas.filter(
        (noticia) => !urlsHistorial.has(noticia.urlNoticia.trim()),
      ).length;
      console.log(
        `[${fuente.nombre}] OK: ${estadoFuente.extraidas} extraídas` +
          (estadoFuente.nuevasReales > 0 ? ` (${estadoFuente.nuevasReales} nuevas)` : " (sin novedades)"),
      );
    } catch (error) {
      estadoFuente.estado = "error";
      estadoFuente.categoriaError = error instanceof ErrorExtraccion ? error.categoria : "red";
      estadoFuente.mensajeError = error instanceof Error ? error.message : String(error);
      console.error(
        `[${fuente.nombre}] FALLO (${estadoFuente.categoriaError}): ${estadoFuente.mensajeError}`,
      );
    }

    estados.push(estadoFuente);
  }

  const fallidas = estados.filter((estadoFuente) => estadoFuente.estado === "error");
  const estado: EstadoCorrida =
    fallidas.length === 0 ? "ok" : fallidas.length === fuentes.length ? "falla-total" : "parcial";
  const exitCode: ResultadoCorrida["exitCode"] =
    estado === "ok" ? 0 : estado === "parcial" ? 2 : 1;

  return { estado, exitCode, fuentes: estados, nuevas };
}

export type { OpcionesDescarga };
