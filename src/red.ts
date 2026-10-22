/**
 * Descarga HTTP con reintentos acotados para el motor multi-fuente.
 *
 * Política de reintento (aprobada en la revisión stage-2):
 * - Se reintenta SOLO en fallas de red, timeout del AbortController y HTTP 5xx.
 * - HTTP 2xx/3xx con content-type inesperado y HTTP 4xx NO se reintentan: son
 *   deterministas y reintentar solo bloquea el turno.
 * - El timeout del fetch no corta el intento: usa AbortController con el
 *   timeout indicado y se trata como error reintentable ("red").
 */

/** Causa raíz de una extracción fallida, para reportar sin texto ad-hoc. */
export type CategoriaError =
  | "red" // falla de red, timeout o HTTP 5xx (reintentable)
  | "http" // HTTP 4xx (determinista, no reintentable)
  | "respuesta-invalida" // 2xx/3xx con content-type inesperado (no reintentable)
  | "estructural" // HTTP OK pero parser devolvió 0 items (HTML cambió)
  | "parser"; // el parser lanzó una excepción

export class ErrorExtraccion extends Error {
  readonly categoria: CategoriaError;

  constructor(mensaje: string, categoria: CategoriaError) {
    super(mensaje);
    this.name = "ErrorExtraccion";
    this.categoria = categoria;
  }
}

export function dormir(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

export interface OpcionesDescarga {
  /** Cantidad total de intentos (por defecto 3: el original + 2 reintentos). */
  intentos?: number | undefined;
  /** Timeout por intento en ms (por defecto 15.000). */
  timeoutMs?: number | undefined;
  /** Substrings aceptados en el header content-type del 2xx. */
  tiposAceptados?: Array<string> | undefined;
  /** Inyectable para tests (por defecto `dormir`). */
  dormir?: ((ms: number) => Promise<void>) | undefined;
  /** Inyectable para tests (por defecto `fetch` global). */
  fetchFn?: (typeof fetch) | undefined;
}

const TIPOS_HTML = ["text/html"];
export const TIPOS_RSS = ["application/rss+xml", "application/xml", "text/xml"];

export interface Descarga {
  html: string;
  /** URL final (post-redirect), base para resolver enlaces relativos. */
  urlBase: string;
}

export async function descargarConReintentos(
  url: string,
  opciones: OpcionesDescarga = {},
): Promise<Descarga> {
  const intentos = opciones.intentos ?? 3;
  const timeoutMs = opciones.timeoutMs ?? 15_000;
  const tiposAceptados = opciones.tiposAceptados ?? TIPOS_HTML;
  const esperar = opciones.dormir ?? dormir;
  const fetchFn = opciones.fetchFn ?? fetch;

  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await descargar(url, { fetchFn, timeoutMs, tiposAceptados });
    
    } catch (error) {
      const detalle =
        error instanceof Error
          ? `${error.name}: ${error.message}` +
            (error.cause instanceof Error
              ? ` | causa: ${error.cause.name}: ${error.cause.message}` +
                ("code" in error.cause
                  ? ` | código: ${String(error.cause.code)}`
                  : "")
              : "")
          : String(error);

      console.error(
        `[HTTP diagnóstico] Intento ${intento}/${intentos} para ${url}: ${detalle}`,
      );

      if (esReintentable(error) && intento < intentos) {
        await esperar(intento * 2000);
        continue;
      }

      throw error;
    }

  }
  /* istanbul ignore next -- lazos no alcanzable */
  throw new ErrorExtraccion(`Agotaron los ${intentos} intentos en ${url}`, "red");
}

async function descargar(
  url: string,
  opciones: Pick<OpcionesDescarga, "fetchFn" | "timeoutMs" | "tiposAceptados">,
): Promise<Descarga> {
  const { fetchFn = fetch, timeoutMs, tiposAceptados = TIPOS_HTML } = opciones;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) {
      const categoria: CategoriaError = response.status >= 500 ? "red" : "http";
      throw new ErrorExtraccion(
        `HTTP ${response.status} ${response.statusText} en ${url}`,
        categoria,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!tiposAceptados.some((tipo) => contentType.includes(tipo))) {
      throw new ErrorExtraccion(
        `content-type inesperado: ${contentType} en ${url}`,
        "respuesta-invalida",
      );
    }
    return { html: await response.text(), urlBase: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

function esReintentable(error: unknown): boolean {
  if (error instanceof ErrorExtraccion) return error.categoria === "red";
  // Timeout del AbortController (DOMException "AbortError") y fallos de red
  // (TypeError de fetch) llegan como Error genérico: reintentables.
  return error instanceof Error;
}
