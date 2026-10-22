import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerLanus } from "../src/extractor/lanus.ts";

const LISTADO = readFileSync(
  new URL("./fixtures/lanus-listado.html", import.meta.url),
  "utf8",
);
const LISTADO_BASE = "https://www.lanus.gob.ar/noticias";

const URL_SALUD =
  "https://www.lanus.gob.ar/noticias/4625-sabados-de-salud-en-la-plaza-del-barrio-centro";
const URL_POLIDEPORTIVO =
  "https://www.lanus.gob.ar/noticias/4624-el-polideportivo-municipal-abre-la-inscripcion-para-las-escuelas-deportivas";
const URL_ESCUELA =
  "https://www.lanus.gob.ar/noticias/4623-se-financiaron-reformas-en-la-escuela-returns";
const URL_CENTRO_SALUD =
  "https://www.lanus.gob.ar/noticias/4621-comenzo-la-construccion-de-un-nuevo-centro-de-salud";
const IMG_SALUD =
  "https://www.lanus.gob.ar/storage/fichas/imagenes/sabados-de-salud.jpeg";

describe("extraerLanus", () => {
  it("extrae las tarjetas del listado descartando duplicados y tarjetas sin enlace", () => {
    const noticias = extraerLanus(LISTADO, LISTADO_BASE);

    expect(noticias).toHaveLength(4);
    expect(noticias.map((noticia) => noticia.urlNoticia)).toEqual([
      URL_SALUD,
      URL_POLIDEPORTIVO,
      URL_ESCUELA,
      URL_CENTRO_SALUD,
    ]);
  });

  it("mapea los campos de la tarjeta: h3 decodifica entidades, imagen del background inline", () => {
    const [salud] = extraerLanus(LISTADO, LISTADO_BASE);

    expect(salud?.titulo).toBe(
      '"SÁBADOS DE SALUD": NUEVO OPERATIVO DE MEDICINA Y ODONTOLOGÍA',
    );
    expect(salud?.imagenUrl).toBe(IMG_SALUD);
    expect(salud?.fecha).toBe("2026-10-21");
    expect(salud?.volanta).toBe("Salud");
    // Evidencia real: resumen casi siempre vacío → descripcion null.
    expect(salud?.descripcion).toBeNull();
    expect(salud?.fuente).toBe("lanus");
  });

  it("el resumen no vacío se convierte en descripcion", () => {
    const noticias = extraerLanus(LISTADO, LISTADO_BASE);
    const polideportivo = noticias.find((noticia) => noticia.urlNoticia === URL_POLIDEPORTIVO);

    expect(polideportivo?.descripcion).toBe(
      "Las inscripciones quedan abiertas desde el lunes en todas las sedes del distrito.",
    );
  });

  it("tarjeta sin fecha produce fecha null conservando la categoría como volanta", () => {
    const noticias = extraerLanus(LISTADO, LISTADO_BASE);
    const escuela = noticias.find((noticia) => noticia.urlNoticia === URL_ESCUELA);

    expect(escuela?.fecha).toBeNull();
    expect(escuela?.volanta).toBe("Cultura");
  });

  it("tarjeta sin imagen produce imagenUrl null", () => {
    const noticias = extraerLanus(LISTADO, LISTADO_BASE);
    const sinImagen = noticias.find((noticia) => noticia.urlNoticia === URL_CENTRO_SALUD);

    expect(sinImagen?.imagenUrl).toBeNull();
  });

  it("un HTML sin article devuelve []: el motor lo marca como error estructural", () => {
    expect(
      extraerLanus("<html><body><nav>otro sitio</nav></body></html>", LISTADO_BASE),
    ).toEqual([]);
  });

  it("un HTML vacío devuelve []", () => {
    expect(extraerLanus("", LISTADO_BASE)).toEqual([]);
  });
});
