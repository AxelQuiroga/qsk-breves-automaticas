/**
 * Registro ejecutable de fuentes, en el orden de inserción de novedades en
 * el historial (más recientes primero dentro de cada fuente, orden del
 * listado oficial verificado en la auditoría).
 *
 * `src/fuentes.ts` guarda solo los metadatos (sin parsers); este módulo
 * agrega el `extraer` de cada parser real.
 */
import type { FuenteEjecutable, FuenteId } from "./fuentes.ts";
import { METADATOS_FUENTES } from "./fuentes.ts";
import { extraerGacetillas } from "./extractor/gacetillas.ts";
import { extraerLanus } from "./extractor/lanus.ts";
import { extraerAvellaneda } from "./extractor/avellaneda.ts";
import { extraerEstebanEcheverria } from "./extractor/echeverria.ts";

const PARSER_POR_FUENTE: Record<FuenteId, FuenteEjecutable["extraer"]> = {
  gba: extraerGacetillas,
  lanus: extraerLanus,
  avellaneda: extraerAvellaneda,
  "esteban-echeverria": extraerEstebanEcheverria,
};

export const FUENTES: FuenteEjecutable[] = METADATOS_FUENTES.map((metadatos) => ({
  ...metadatos,
  extraer: PARSER_POR_FUENTE[metadatos.id],
}));
