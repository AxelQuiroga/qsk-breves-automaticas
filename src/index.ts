/**
 * Extrae las tarjetas de gacetillas a data/gacetillas.json.
 * Uso:
 *   pnpm extraer                      -> descarga la página real y actualiza el historial
 *   pnpm extraer ruta/archivo.html    -> extrae desde un HTML local, sin tocar el historial
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { combinarHistorial, verificarHistorialCompleto } from "./historial.ts";
import { completarSlugs } from "./slugs.ts";
import { extraerGacetillas } from "./extractor/gacetillas.ts";
import type { Noticia } from "./types/noticia.ts";

const FUENTE_URL = "https://www.gba.gob.ar/comunicacion_publica/gacetillas";
const SALIDA = new URL("../data/gacetillas.json", import.meta.url);
const HISTORIAL = new URL("../data/gacetillas-historial.json", import.meta.url);
const TIMEOUT_MS = 15_000;

async function leerHistorial(): Promise<Noticia[]> {
  const contenido = await readFile(HISTORIAL, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "[]";
    throw error;
  });
  const historial: unknown = JSON.parse(contenido);
  if (!Array.isArray(historial)) {
    throw new Error("El historial de gacetillas no contiene un array JSON.");
  }
  return historial as Noticia[];
}

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

    const nuevas = extraerGacetillas(html, urlBase);
    if (nuevas.length === 0) {
      throw new Error("No se extrajo ninguna gacetilla. Se conserva el historial anterior.");
    }

    // En pruebas con HTML local se conserva el comportamiento de extracción aislada.
    // En producción se combinan las novedades con el historial persistido en el repositorio.
    const historialAnterior = archivoLocal ? [] : await leerHistorial();
    const fusion = combinarHistorial(nuevas, historialAnterior);
    const noticias = completarSlugs(fusion, historialAnterior);

    // Protección contra pérdida silenciosa: el historial nunca se reduce.
    verificarHistorialCompleto(noticias, historialAnterior);

    if (!archivoLocal) {
      await writeFile(HISTORIAL, JSON.stringify(noticias, null, 2) + "\n", "utf8");
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
    const conSlug = noticias.filter((n) => typeof n.slug === "string" && /^[a-z0-9-]+$/.test(n.slug)).length;

    console.log(`\nGacetillas nuevas detectadas: ${nuevas.length}`);
    console.log(`Gacetillas finales (historial completo): ${noticias.length}`);
    console.log(`  con título:       ${conTitulo}`);
    console.log(`  con descripción:  ${conDescripcion}`);
    console.log(`  con imagen:       ${conImagen}`);
    console.log(`  con URL válida:   ${conUrl}`);
    console.log(`  con fecha:        ${conFecha}`);
    console.log(`  con slug persistente: ${conSlug}`);
    if (!archivoLocal) console.log(`Historial actualizado: ${HISTORIAL.pathname}`);
    console.log(`JSON de salida: ${SALIDA.pathname}`);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${mensaje}`);
    process.exitCode = 1;
  }
}

await main();
