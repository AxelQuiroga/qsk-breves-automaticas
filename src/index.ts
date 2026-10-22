/**
 * Extrae las gacetillas de todas las fuentes registradas (src/fuentes.ts)
 * y actualiza el historial persistente.
 * Uso:
 *   pnpm extraer                      -> extrae TODAS las fuentes y actualiza el historial
 *   pnpm extraer ruta/archivo.html    -> extrae el HTML local como listado de GBA,
 *                                        sin tocar el historial (modo testing)
 *
 * Códigos de salida de la corrida completa:
 *   0 = todas las fuentes OK
 *   2 = corrida parcial (alguna fuente falló; las sanas aportaron datos y persisten)
 *   1 = todas las fuentes fallaron (no se persiste nada)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  combinarHistorial,
  verificarHistorialCompleto,
  verificarHistorialCompletoPorFuente,
} from "./historial.ts";
import { completarFuentes } from "./fuentes.ts";
import { completarSlugs } from "./slugs.ts";
import { correrExtraccion, type EstadoCorrida, type EstadoFuente } from "./motor.ts";
import { extraerGacetillas } from "./extractor/gacetillas.ts";
import type { Noticia } from "./types/noticia.ts";

const FUENTE_URL = "https://www.gba.gob.ar/comunicacion_publica/gacetillas";
const SALIDA = new URL("../data/gacetillas.json", import.meta.url);
const HISTORIAL = new URL("../data/gacetillas-historial.json", import.meta.url);
const ESTADO_CORRIDA = new URL("../data/estado-corrida.json", import.meta.url);
const TIMEOUT_MS = 15_000;

interface EstadoCorridaArchivo {
  estado: EstadoCorrida | "en-curso";
  generadaEn: string;
  exitCode?: number;
  totalNoticias?: number;
  novedadesReales?: number;
  fuentes?: EstadoFuente[];
}

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

async function escribirEstadoCorrida(estado: EstadoCorridaArchivo): Promise<void> {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(ESTADO_CORRIDA, JSON.stringify(estado, null, 2) + "\n", "utf8");
}

function loguearEstadisticas(noticias: Noticia[]): void {
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
  const conFuente = noticias.filter(
    (n) => n.fuente === "gba" || n.fuente === "lanus" || n.fuente === "avellaneda" || n.fuente === "esteban-echeverria",
  ).length;

  console.log(`Gacetillas finales (historial completo): ${noticias.length}`);
  console.log(`  con título:       ${conTitulo}`);
  console.log(`  con descripción:  ${conDescripcion}`);
  console.log(`  con imagen:       ${conImagen}`);
  console.log(`  con URL válida:   ${conUrl}`);
  console.log(`  con fecha:        ${conFecha}`);
  console.log(`  con slug persistente: ${conSlug}`);
  console.log(`  con fuente:       ${conFuente}`);
}

async function main(): Promise<void> {
  const archivoLocal = process.argv[2];

  try {
    if (archivoLocal) {
      // Modo testing: un solo HTML se interpreta como listado de GBA y no
      // toca el historial (comportamiento previo mantenido; el dataset
      // narrado recibe `fuente` por backfill de dominio como el resto).
      const contenido = await readFile(archivoLocal, "utf8");
      const urlBase = FUENTE_URL;
      console.log(`HTML local: ${archivoLocal}`);

      const nuevas = extraerGacetillas(contenido, urlBase);
      if (nuevas.length === 0) {
        throw new Error("No se extrajo ninguna gacetilla del HTML local.");
      }

      const fusion = completarFuentes(combinarHistorial(nuevas, []));
      const noticias = completarSlugs(fusion, []);
      verificarHistorialCompleto(noticias, []);
      verificarHistorialCompletoPorFuente(noticias, []);

      await mkdir(new URL("../data/", import.meta.url), { recursive: true });
      await writeFile(SALIDA, JSON.stringify(noticias, null, 2) + "\n", "utf8");

      console.log(`\nPágina local: ${archivoLocal}`);
      console.log(`Noticias extraídas: ${nuevas.length}`);
      loguearEstadisticas(noticias);
      console.log(`JSON de salida: ${SALIDA.pathname}`);
      return;
    }

    const historial = await leerHistorial();

    // Marcado "en-curso": si el proceso muere a mitad, el archivo queda con
    // un estado que la validación del workflow NO acepta como resultado.
    await escribirEstadoCorrida({ estado: "en-curso", generadaEn: new Date().toISOString() });

    const corrida = await correrExtraccion({ historial });

    if (corrida.exitCode === 1) {
      await escribirEstadoCorrida({
        estado: "falla-total",
        generadaEn: new Date().toISOString(),
        exitCode: corrida.exitCode,
        fuentes: corrida.fuentes,
      });
      console.error("Todas las fuentes fallaron. No se persistió nada.");
      process.exitCode = 1;
      return;
    }

    // En pruebas con HTML local se conserva el comportamiento de extracción
    // aislada. En producción se combinan las novedades de las fuentes sanas
    // con el historial persistido en el repositorio (las fuentes fallidas
    // conservan sus registros históricos intactos).
    const fusion = combinarHistorial(corrida.nuevas, historial);
    const conFuente = completarFuentes(fusion);
    const noticias = completarSlugs(conFuente, historial);

    // Protección contra pérdida silenciosa: global Y por fuente.
    verificarHistorialCompleto(noticias, historial);
    verificarHistorialCompletoPorFuente(noticias, historial);

    await mkdir(new URL("../data/", import.meta.url), { recursive: true });
    await writeFile(HISTORIAL, JSON.stringify(noticias, null, 2) + "\n", "utf8");
    await writeFile(SALIDA, JSON.stringify(noticias, null, 2) + "\n", "utf8");

    const novedadesReales = corrida.fuentes.reduce((total, fuente) => total + fuente.nuevasReales, 0);
    await escribirEstadoCorrida({
      estado: corrida.estado,
      generadaEn: new Date().toISOString(),
      exitCode: corrida.exitCode,
      totalNoticias: noticias.length,
      novedadesReales,
      fuentes: corrida.fuentes,
    });

    console.log(`\nPágina de fuentes sanas: ${corrida.fuentes.filter((f) => f.estado === "ok").length}/${corrida.fuentes.length}`);
    loguearEstadisticas(noticias);
    console.log(`Historial actualizado: ${HISTORIAL.pathname}`);
    console.log(`JSON de salida: ${SALIDA.pathname}`);
    console.log(`Estado corrida: ${corrida.estado} (exit ${corrida.exitCode})`);
    process.exitCode = corrida.exitCode;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(`ERROR: ${mensaje}`);
    process.exitCode = 1;
  }
}

await main();
