import type { Noticia } from "./types/noticia.ts";

/**
 * Slugs persistentes de las gacetillas.
 *
 * El slug se define UNA sola vez, al momento de la extracción, y queda
 * almacenado en el historial: es la identidad de la URL individual de la
 * gacetilla en QSK Noticias. Después de ese momento nunca se recalcula,
 * aunque cambie el título o la posición en el listado.
 *
 * `slugificar` es una copia exacta de `slugify()` del portal
 * (`src/lib/utils.ts` de AxelQuiroga/QSK-Noticias). El test de este módulo
 * verifica contra los slugs reales del dataset publicado, así que la copia
 * no puede divergir en silencio — mismo esquema que usa el portal con
 * `slugifyLite` en `src/lib/sitemap-policy.mjs`.
 */

/** Copia exacta de `slugify()` de `src/lib/utils.ts`. No modificar sin revisar el portal. */
export function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

const SLUG_VALIDO = /^[a-z0-9-]+$/;
const FALLBACK_SLUG = "gacetilla";

/**
 * Nombres reservados por QSK Noticias en /gacetillas-oficiales/: `archivo`
 * (archivo histórico global) y `fuente` (prefijo de las secciones per-source,
 * /gacetillas-oficiales/fuente/&lt;id&gt;/). Un slug `archivo` o `fuente`
 * colisionaría con esas rutas, así que al derivar se lo saltea.
 */
const SLUGS_RESERVADOS = new Set(["archivo", "fuente"]);

/** Decisión pendiente (deriva del título) o ya tomada (inmutable). */
type Decision = { nuevo: true } | { nuevo: false; slug: string };

/**
 * Asigna y garantiza el slug de cada gacetilla del historial combinado.
 *
 * 1. Todo slug ya almacenado en el historial queda reservado, aunque la
 *    gacetilla no esté en la lista.
 * 2. Si la gacetilla trae su propio slug válido, se respeta.
 * 3. Si no, se hereda el de la entrada previa con la misma URL; si la
 *    previa es previa a la migración y no tiene slug, se congela el que
 *    resulta de su primer título conocido (la URL de QSK hereda esa
 *    identidad, no la del texto reescrito).
 * 4. Solo las gacetillas nuevas derivan `slugificar(titulo)`, resolviendo
 *    colisiones con un sufijo numérico (`-2`, `-3`, ...) en orden de llegada.
 */
export function completarSlugs(gacetillas: Noticia[], previas: Noticia[]): Noticia[] {
  const usados = new Set<string>();

  for (const previa of previas) {
    if (previa.slug && SLUG_VALIDO.test(previa.slug)) usados.add(previa.slug);
  }

  const porUrl = new Map<string, string>();
  for (const previa of previas) {
    const heredado =
      previa.slug && SLUG_VALIDO.test(previa.slug)
        ? previa.slug
        : slugificar(previa.titulo) || FALLBACK_SLUG;
    porUrl.set(previa.urlNoticia, heredado);
  }

  const decisiones: Decision[] = gacetillas.map((gacetilla) => {
    if (gacetilla.slug && SLUG_VALIDO.test(gacetilla.slug)) {
      return { nuevo: false, slug: gacetilla.slug };
    }
    const heredado = porUrl.get(gacetilla.urlNoticia);
    return heredado ? { nuevo: false, slug: heredado } : { nuevo: true };
  });

  for (const decision of decisiones) {
    if (!decision.nuevo) usados.add(decision.slug);
  }

  return gacetillas.map((gacetilla, indice) => {
    const decision = decisiones[indice];
    if (decision && !decision.nuevo) return { ...gacetilla, slug: decision.slug };

    const base = slugificar(gacetilla.titulo) || FALLBACK_SLUG;
    let asignado = base;
    let sufijo = 2;
    while (usados.has(asignado) || SLUGS_RESERVADOS.has(asignado)) {
      asignado = `${base}-${sufijo++}`;
    }
    usados.add(asignado);

    return { ...gacetilla, slug: asignado };
  });
}
