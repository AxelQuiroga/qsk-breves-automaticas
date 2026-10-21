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
  /** Fecha de la noticia. El listado actual no expone fecha en las tarjetas: siempre `null`. */
  fecha: string | null;
  /** Volanta / etiqueta geográfica o temática (campo `field-volanta-noticia`). */
  volanta: string | null;
}
