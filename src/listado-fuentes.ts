/**
 * Registro ejecutable de fuentes, en el orden de inserci\u00f3n de novedades en
 * el historial (m\u00e1s recientes primero dentro de cada fuente, orden del
 * listado oficial verificado en la auditor\u00eda).
 *
 * `src/fuentes.ts` guarda solo los metadatos (sin parsers); este m\u00f3dulo
 * agrega el `extraer` y, cuando aplica, el `enriquecerDescripcion` de cada
 * fuente. El motor consume este listado sin conocer qu\u00e9 fuentes necesitan
 * enriquecimiento.
 */
import type { FuenteEjecutable, FuenteId } from "./fuentes.ts";
import { METADATOS_FUENTES } from "./fuentes.ts";
import { extraerGacetillas } from "./extractor/gacetillas.ts";
import { extraerLanus, extraerDescripcionLanus } from "./extractor/lanus.ts";
import { extraerAvellaneda, extraerDescripcionAvellaneda } from "./extractor/avellaneda.ts";
import { extraerEstebanEcheverria } from "./extractor/echeverria.ts";

const PARSER_POR_FUENTE: Record<FuenteId, Pick<FuenteEjecutable, "extraer" | "enriquecerDescripcion">> = {
  gba: { extraer: extraerGacetillas },
  lanus: { extraer: extraerLanus, enriquecerDescripcion: extraerDescripcionLanus },
  avellaneda: { extraer: extraerAvellaneda, enriquecerDescripcion: extraerDescripcionAvellaneda },
  "esteban-echeverria": { extraer: extraerEstebanEcheverria },
};

export const FUENTES: FuenteEjecutable[] = METADATOS_FUENTES.map((metadatos) => ({
  ...metadatos,
  ...PARSER_POR_FUENTE[metadatos.id],
}));