/**
 * Noticia tal como aparece en una tarjeta del listado de gacetillas.
 * Los campos opcionales se representan como `null` (nunca se inventan valores).
 */
export interface Noticia {
  /** Título de la noticia (campo `field-name-title`). */
  titulo: string;
  /** Bajada breve (campo `field-bajada-noti-agroindustria`). `null` si no existe. */
  descripcion: string | null;
  /** URL absoluta de la imagen (campo `field-imagen-medios`). `null` si no hay imagen. */
  imagenUrl: string | null;
  /** URL absoluta de la noticia original, resuelta desde el `href` del título. */
  urlNoticia: string;
  /** Fecha ISO `YYYY-MM-DD` (zona horaria de la fuente). `null` si la fuente no la expone. */
  fecha: string | null;
  /** Volanta / etiqueta geográfica o temática. `null` si la fuente no la expone. */
  volanta: string | null;
  /**
   * Identificador de la fuente (`src/fuentes.ts`): "gba", "lanus",
   * "avellaneda", "esteban-echeverria". Los parsers lo asignan al extraer;
   * los registros históricos previos a la migración lo reciben por backfill
   * determinista desde el dominio de su URL (`completarFuentes`). En el
   * dataset final es obligatorio y siempre coincide con el dominio de la
   * URL: cualquier ambigüedad aborta la persistencia.
   */
  fuente?: string;
  /**
   * Slug URL-friendly asignado por `completarSlugs` al momento de la
   * extracción. Es la identidad de la URL en QSK Noticias
   * (`/gacetillas-oficiales/<slug>/`): persiste en el historial y nunca
   * se vuelve a derivar a partir del título, para que el orden del
   * listado o una actualización del texto no rompan la URL.
   */
  slug?: string;
}
