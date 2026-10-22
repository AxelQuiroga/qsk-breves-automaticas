import { describe, expect, it } from "vitest";
import type { Noticia } from "../src/types/noticia.ts";
import { completarSlugs, slugificar } from "../src/slugs.ts";

/**
 * Pares (título, slug) reales del dataset publicado en QSK Noticias
 * (src/data/gacetillas.json del portal). Los slugs esperados fueron
 * generados con `slugify()` de `src/lib/utils.ts` del portal.
 *
 * Si esta tabla diverge, la URL individual de alguna gacetilla publicada
 * cambiaría en el portal. El test debe fallar ANTES de actualizar QSK.
 */
const TITULOS_Y_SLUGS_DEL_PORTAL: Array<[string, string]> = [
  [
    "Kicillof encabezó la presentación del programa “Empleo Verde Joven”",
    "kicillof-encabezo-la-presentacion-del-programa-empleo-verde-joven",
  ],
  [
    "Kicillof entregó viviendas a familias de Tristán Suárez",
    "kicillof-entrego-viviendas-a-familias-de-tristan-suarez",
  ],
  [
    "Kicillof encabezó la apertura de la etapa final de los Juegos Bonaerenses 2026",
    "kicillof-encabezo-la-apertura-de-la-etapa-final-de-los-juegos-bonaerenses-2026",
  ],
  [
    "Kicillof inauguró un Centro de Desarrollo Infantil y entregó viviendas paralizadas por el Gobierno nacional",
    "kicillof-inauguro-un-centro-de-desarrollo-infantil-y-entrego-viviendas-paralizadas-por-el-gobierno-nacional",
  ],
  [
    "Kicillof participó de la apertura de la 2° Cumbre Federal de Logística",
    "kicillof-participo-de-la-apertura-de-la-2-cumbre-federal-de-logistica",
  ],
  [
    "Kicillof participó de la 5° Marcha Federal Universitaria",
    "kicillof-participo-de-la-5-marcha-federal-universitaria",
  ],
  [
    "Más de 160 personas participaron del curso sobre Periodismo Local y Comunitario",
    "mas-de-160-personas-participaron-del-curso-sobre-periodismo-local-y-comunitario",
  ],
  [
    "Kicillof recorrió la nueva base de la UTOI en San Isidro",
    "kicillof-recorrio-la-nueva-base-de-la-utoi-en-san-isidro",
  ],
  [
    "Kicillof y Kreplak encabezaron la presentación del 2° Plan Provincial de Salud Mental",
    "kicillof-y-kreplak-encabezaron-la-presentacion-del-2-plan-provincial-de-salud-mental",
  ],
  [
    "La muestra “Vidas submarinas” comienza su recorrido por la provincia",
    "la-muestra-vidas-submarinas-comienza-su-recorrido-por-la-provincia",
  ],
  [
    'Kicillof: "No vamos a mejorar la educación con recetas importadas, vamos a hacerlo junto a los docentes y los estudiantes"',
    "kicillof-no-vamos-a-mejorar-la-educacion-con-recetas-importadas-vamos-a-hacerlo-junto-a-los-docentes-y-los-estudiantes",
  ],
  [
    "Kicillof entregó escrituras gratuitas a familias de Nueve de Julio",
    "kicillof-entrego-escrituras-gratuitas-a-familias-de-nueve-de-julio",
  ],
];

function gacetilla(n: number, titulo: string, slug?: string): Noticia {
  return {
    titulo,
    descripcion: null,
    imagenUrl: null,
    urlNoticia: `https://www.gba.gob.ar/comunicacion_publica/gacetillas/prueba-${n}`,
    fecha: null,
    volanta: null,
    ...(slug ? { slug } : {}),
  };
}

describe("slugificar", () => {
  it("produce exactamente los slugs que el portal genera con su slugify()", () => {
    for (const [titulo, esperado] of TITULOS_Y_SLUGS_DEL_PORTAL) {
      expect(slugificar(titulo)).toBe(esperado);
    }
  });

  it("colapsa mayúsculas, tildes y signos como el portal", () => {
    expect(slugificar("Título con Acentos ÁÉÍÓÚ")).toBe("titulo-con-acentos-aeiou");
  });
});

describe("completarSlugs", () => {
  it("deriva un slug determinista para cada gacetilla nueva", () => {
    const resultado = completarSlugs(
      [gacetilla(1, "Gacetilla nueva de prueba")],
      [],
    );

    expect(resultado[0]?.slug).toBe("gacetilla-nueva-de-prueba");
  });

  it("resuelve colisiones de título con sufijo numérico en orden de llegada", () => {
    const resultado = completarSlugs(
      [
        gacetilla(1, "Obra repetida"),
        gacetilla(2, "Obra repetida"),
        gacetilla(3, "Otra obra"),
      ],
      [],
    );

    expect(resultado.map((g) => g.slug)).toEqual([
      "obra-repetida",
      "obra-repetida-2",
      "otra-obra",
    ]);
  });

  it("hereda el slug de la entrada previa con la misma URL aunque el título cambie", () => {
    const previa = gacetilla(1, "Título original");
    const actualizada: Noticia = {
      ...gacetilla(1, "Título actualizado como quedó mejor"),
      urlNoticia: previa.urlNoticia,
    };

    const resultado = completarSlugs([actualizada], [previa]);

    expect(resultado[0]?.slug).toBe("titulo-original");
    expect(resultado[0]?.slug).not.toBe("titulo-actualizado-como-quedo-mejor");
  });

  it("respeta un slug que ya viene en la gacetilla", () => {
    const resultado = completarSlugs(
      [gacetilla(1, "Gacetilla nueva", "slug-casi-a-mano")],
      [],
    );

    expect(resultado[0]?.slug).toBe("slug-casi-a-mano");
  });

  it("no reasigna un slug reservado por el historial a otra gacetilla", () => {
    const previa = gacetilla(1, "Gacetilla de prueba", "gacetilla-de-prueba");
    const nueva = gacetilla(2, "Gacetilla de prueba");

    const resultado = completarSlugs([nueva], [previa]);

    expect(resultado[0]?.slug).toBe("gacetilla-de-prueba-2");
  });

  it("usa el slug de reserva cuando el título no produce ninguno", () => {
    const resultado = completarSlugs(
      [gacetilla(1, "/// ___ ⑂")],
      [],
    );

    expect(resultado[0]?.slug).toBe("gacetilla");
  });

  it("todas las gacetillas terminan con un único slug válido", () => {
    const previas = [gacetilla(1, "Gacetilla de prueba")];
    const nuevas = [gacetilla(2, "Obra repetida"), gacetilla(3, "Gacetilla de prueba")];
    const resultado = completarSlugs([...nuevas, ...previas], []);

    const slugs = resultado.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
