import {
  descargarConReintentos,
  ErrorExtraccion,
  TIPOS_RSS,
  type OpcionesDescarga,
  type Descarga,
} from "../red.ts";
import { ErrorOleFeed } from "./errors.ts";

export const OLE_RSS_URL = "https://www.ole.com.ar/rss/ultimas-noticias/";

type OpcionesClienteOle = Pick<OpcionesDescarga, "fetchFn" | "dormir" | "intentos" | "timeoutMs">;

/** Cliente aislado que reutiliza la política HTTP común y conserva errores tipados. */
export async function descargarFeedOle(opciones: OpcionesClienteOle = {}): Promise<Descarga> {
  try {
    return await descargarConReintentos(OLE_RSS_URL, {
      ...opciones,
      tiposAceptados: TIPOS_RSS,
    });
  } catch (error) {
    if (error instanceof ErrorOleFeed) throw error;
    if (error instanceof ErrorExtraccion) {
      const status = Number(error.message.match(/HTTP (\d{3})/)?.[1] ?? 0) || null;
      const categoria = error.categoria === "respuesta-invalida"
        ? "respuesta-invalida"
        : status === 403
          ? "acceso-denegado"
          : error.categoria === "http"
            ? "http"
            : "red";
      throw new ErrorOleFeed(error.message, categoria, status, { cause: error });
    }
    throw new ErrorOleFeed(
      error instanceof Error ? error.message : "Error de red desconocido al descargar Olé",
      "red",
      null,
      { cause: error },
    );
  }
}

export { ErrorOleFeed } from "./errors.ts";
