import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { descargarFeedOle } from "./client.ts";
import { parsearFeedOle } from "./parser.ts";
import { normalizarNoticiasOle } from "./normalizer.ts";
import type { Descarga } from "../red.ts";
import type { OleNews } from "./types.ts";

export interface OpcionesGeneradorOle {
  /** Ruta de salida configurable para pruebas; en producción usa data/ole-noticias.json. */
  rutaSalida?: string;
  /** Punto de inyección para probar sin depender de la red. */
  descargar?: () => Promise<Descarga>;
}

const SALIDA_POR_DEFECTO = fileURLToPath(new URL("../../data/ole-noticias.json", import.meta.url));

/**
 * Descarga, valida y normaliza el RSS de Olé antes de persistirlo.
 * La escritura se hace mediante un archivo temporal y rename, de modo que
 * una descarga o parseo fallido nunca reemplace el último JSON válido.
 */
export async function generarArchivoOle(opciones: OpcionesGeneradorOle = {}): Promise<OleNews[]> {
  const descargar = opciones.descargar ?? descargarFeedOle;
  const rutaSalida = opciones.rutaSalida ?? SALIDA_POR_DEFECTO;

  const respuesta = await descargar();
  const noticias = normalizarNoticiasOle(parsearFeedOle(respuesta.html));

  await mkdir(dirname(rutaSalida), { recursive: true });
  const temporal = join(
    dirname(rutaSalida),
    `.${basename(rutaSalida)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporal, JSON.stringify(noticias, null, 2) + "\n", {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporal, rutaSalida);
  } catch (error) {
    await rm(temporal, { force: true }).catch(() => undefined);
    throw error;
  }

  return noticias;
}
