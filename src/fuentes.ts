/**
 * Metadatos de fuentes de gacetillas y resolución de identidad de registros.
 *
 * Cada registro del dataset lleva `fuente` (id del municipio/provincia).
 * El identificador se asigna al extraer y se valida cruzándolo con el
 * dominio de la URL: una URL fuera del dominio de su fuente declarada o
 * de una fuente no registrada es una inconsistencia que aborta la
 * persistencia (decisión aprobada: identificar de forma ambigua es un
 * error, no un warning).
 *
 * Este módulo NO importa los parsers: solo describe y resuelve identidad.
 * La lista ejecutable (con `extraer`, en el orden de inserción del
 * historial) está en `src/listado-fuentes.ts`.
 */
import type { Noticia } from "./types/noticia.ts";

export type FuenteId = "gba" | "lanus" | "avellaneda" | "esteban-echeverria";

/** Descripción de una fuente (identidad + URL de listado, sin parser). */
export interface FuenteDef {
  /** Identificador estable, igual al campo `fuente` del dataset. */
  id: FuenteId;
  /** Nombre para mostrar en GitHub Actions y (más adelante) en QSK. */
  nombre: string;
  /** Host exacto (con www) donde deben vivir las URLs de la fuente. */
  dominio: string;
  /** URL de listado/feed que se descarga en cada corrida. */
  listarUrl: string;
  /** Substrings esperados en el content-type del 2xx. */
  tiposAceptados: string[];
}

/** Fuente con su parser agregado, lista para ejecutar en una corrida. */
export interface FuenteEjecutable extends FuenteDef {
  /** Parser del listado. Devuelve `[]` si el HTML/feed no trae lo esperado. */
  extraer: (texto: string, urlBase: string) => Noticia[];
  /**
   * Extrae la descripci\u00f3n de la p\u00e1gina individual de una noticia.
   * Solo para fuentes cuyo listado no incluye descripci\u00f3n.
   * Si est\u00e1 ausente, no se realiza enriquecimiento para esta fuente.
   */
  enriquecerDescripcion?: (html: string) => string | null;
}

/** Registro del dataset con la fuente ya resuelta (salida de `completarFuentes`). */
export type NoticiaConFuente = Noticia & { fuente: string };

/** Metadatos de todas las fuentes conocidas. */
export const METADATOS_FUENTES: FuenteDef[] = [
  {
    id: "gba",
    nombre: "Gobierno de la Provincia de Buenos Aires",
    dominio: "www.gba.gob.ar",
    listarUrl: "https://www.gba.gob.ar/comunicacion_publica/gacetillas",
    tiposAceptados: ["text/html"],
  },
  {
    id: "lanus",
    nombre: "Municipalidad de Lanús",
    dominio: "www.lanus.gob.ar",
    listarUrl: "https://www.lanus.gob.ar/noticias",
    tiposAceptados: ["text/html"],
  },
  {
    id: "avellaneda",
    nombre: "Municipalidad de Avellaneda",
    dominio: "www.mda.gob.ar",
    listarUrl: "https://www.mda.gob.ar/noticias/",
    tiposAceptados: ["text/html"],
  },
  {
    id: "esteban-echeverria",
    nombre: "Municipalidad de Esteban Echeverría",
    dominio: "www.estebanecheverria.gob.ar",
    listarUrl: "https://www.estebanecheverria.gob.ar/feed/",
    tiposAceptados: ["application/rss+xml", "application/xml", "text/xml"],
  },
];

/** Máximo de noticias por fuente y corrida (límite de presentación, NO de borrado). */
export const LIMITE_POR_FUENTE = 12;

export function fuentePorId(
  id: string,
  fuentes: Array<FuenteDef> = METADATOS_FUENTES,
): FuenteDef | undefined {
  return fuentes.find((fuente) => fuente.id === id);
}

function dominioDe(urlNoticia: string): string | null {
  try {
    return new URL(urlNoticia).host;
  } catch {
    return null;
  }
}

/**
 * Asegura que cada registro declare su fuente y que cuadre con su dominio.
 *
 * - Registro con `fuente` ya seteada: se valida contra el dominio (idempotente).
 * - Registro sin `fuente` (histórico previo a la migración): se completa por
 *   dominio de su URL verificada.
 * - Dominio desconocido, URL inválida o `fuente` que no coincide con el
 *   dominio: lanza; la corrida no persiste nada.
 */
export function completarFuentes(
  noticias: Noticia[],
  fuentes: Array<FuenteDef> = METADATOS_FUENTES,
): Array<NoticiaConFuente> {
  const dominioAId = new Map(fuentes.map((fuente) => [fuente.dominio, fuente.id]));

  return noticias.map((noticia) => {
    const dominio = dominioDe(noticia.urlNoticia);
    if (!dominio) {
      throw new Error(`URL inválida en el dataset: ${noticia.urlNoticia}`);
    }
    const id = dominioAId.get(dominio);
    if (!id) {
      throw new Error(
        `La URL ${noticia.urlNoticia} (dominio ${dominio}) no pertenece a ninguna fuente registrada.`,
      );
    }
    if (noticia.fuente && noticia.fuente !== id) {
      throw new Error(
        `Inconsistencia: la fuente declarada "${noticia.fuente}" no coincide con el dominio` +
          ` ${dominio} de ${noticia.urlNoticia} (fuente esperada: "${id}").`,
      );
    }
    // Seguro: para este punto toda noticia tiene `fuente` (la declarada validada
    // o el backfill por dominio); solo el sistema de tipos la ve opcional.
    const resuelta = (noticia.fuente ? noticia : { ...noticia, fuente: id }) as NoticiaConFuente;
    return resuelta;
  });
}
