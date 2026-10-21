/**
 * Extrae las tarjetas de gacetillas a data/gacetillas.json.
 * Uso:
 *   pnpm extraer                      -> descarga la página real y extrae
 *   pnpm extraer ruta/archivo.html    -> extrae desde un HTML local (sin red)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extraerGacetillas } from "./extractor/gacetillas.ts";

const FUENTE_URL = "https://www.gba.gob.ar/comunicacion_publica/gacetillas";
const SALIDA = new URL("../data/gacetillas.json", import.meta.url);
const TIMEOUT_MS = 15_000;

async function main(): Promise<void> {
  const archivoLocal = process.argv[2];
  let html: string;
  let urlBase: string;

  try {
    if (archivoLocal) {
      html = await readFile(archivoLocal, "utf8");
      urlBase = FUENTE_URL;
      console.log(`HTML local: ${archivoLocal}`);
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(FUENTE_URL, {
          signal: controller.signal,
          redirect: "follow",
        });
        console.log(`HTTP ${response.status} ${response.statusText}`);
        console.log(`content-type: ${response.headers.get("content-type") ?? "(sin header)"}`);

        if (!response.ok) {
          throw new Error(`respuesta HTTP no exitosa: ${response.status}`);
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) {
          throw new Error(`content-type inesperado: ${contentType}`);
        }
        // URL final (post-redirect) como base para resolver enlaces relativos.
        html = await response.text();
        urlBase = response.url;
      } finally {
        clearTimeout(timeout);
      }
    }
    const noticias = extraerGacetillas(html, urlBase);

    if (noticias.length === 0) {
      console.warn("AVISO: 0 tarjetas extraídas. Posible cambio de estructura en la fuente.");
    }

    await mkdir(new URL("../data/", import.meta.url), { recursive: true });
    await writeFile(SALIDA, JSON.stringify(noticias, null, 2) + "\n", "utf8");

    const conTitulo = noticias.filter((n) => n.titulo.length > 0).length;
    const conDescripcion = noticias.filter((n) => n.descripcion !== null).length;
    const conImagen = noticias.filter((n) => n.imagenUrl !== null).length;
    const conUrl = noticias.filter((n) => {
      try {
        new URL(n.urlNoticia);
        return true;
      } catch {
        return false;
      }
    }).length;
    const conFecha = noticias.filter((n) => n.fecha !== null).length;

    console.log(`\nTarjetas detectadas: ${noticias.length}`);
    console.log(`  con título:       ${conTitulo}`);
    console.log(`  con descripción:  ${conDescripcion}`);
    console.log(`  con imagen:       ${conImagen}`);
    console.log(`  con URL válida:   ${conUrl}`);
    console.log(`  con fecha:        ${conFecha}`);
    console.log(`JSON guardado en: ${SALIDA.pathname}`);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${mensaje}`);
    process.exitCode = 1;
  }
}

await main();
