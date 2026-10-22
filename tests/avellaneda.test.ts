import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerAvellaneda, parsearFechaAvellaneda } from "../src/extractor/avellaneda.ts";

const LISTADO = readFileSync(
  new URL("./fixtures/avellaneda-listado.html", import.meta.url),
  "utf8",
);
const LISTADO_BASE = "https://www.mda.gob.ar/noticias/";

const URL_ESPERADAS = [
  "https://www.mda.gob.ar/noticias/magdalena-sierra-participo-de-jornadas-de-trabajo-en-el-distrito/",
  "https://www.mda.gob.ar/noticias/la-delegacion-de-claypole-recibe-juegos-de-mesa-y-sillas/",
  "https://www.mda.gob.ar/noticias/retomaron-las-tareas-de-obra-en-salud-en-tu-barrio/",
  "https://www.mda.gob.ar/noticias/inscripcion-abierta-para-las-escuelas-municipales/",
  "https://www.mda.gob.ar/noticias/noticia-con-href-relativo/",
];

describe("extraerAvellaneda", () => {
  it("extrae las tarjetas del archive descartando duplicados y tarjetas sin título", () => {
    const noticias = extraerAvellaneda(LISTADO, LISTADO_BASE);

    expect(noticias.map((noticia) => noticia.urlNoticia)).toEqual(URL_ESPERADAS);
  });

  it("mapea los campos de la tarjeta: imagen wp-post-image, fecha con mapa de meses", () => {
    const noticias = extraerAvellaneda(LISTADO, LISTADO_BASE);
    const sierra = noticias[0];

    expect(sierra?.titulo).toBe(
      "Magdalena Sierra participó de jornadas de trabajo en el distrito",
    );
    expect(sierra?.fecha).toBe("2026-10-21");
    expect(sierra?.imagenUrl).toBe(
      "https://www.mda.gob.ar/wp-content/uploads/2026/10/sierra-jornadas.jpg",
    );
    expect(sierra?.descripcion).toBeNull();
    expect(sierra?.volanta).toBeNull();
    expect(sierra?.fuente).toBe("avellaneda");
  });

  it("tarjeta sin fecha produce fecha null", () => {
    const noticias = extraerAvellaneda(LISTADO, LISTADO_BASE);
    const saludBarrio = noticias.find((noticia) =>
      noticia.urlNoticia.startsWith(
        "https://www.mda.gob.ar/noticias/retomaron-las-tareas-de-obra-en-salud-en-tu-barrio",
      ),
    );

    expect(saludBarrio?.fecha).toBeNull();
  });

  it("resuelve hrefs relativos contra la URL del archive", () => {
    const noticias = extraerAvellaneda(LISTADO, LISTADO_BASE);

    expect(noticias[URL_ESPERADAS.length - 1]?.urlNoticia).toBe(
      "https://www.mda.gob.ar/noticias/noticia-con-href-relativo/",
    );
  });

  it("un HTML sin a.noticias-caja devuelve []: el motor lo marca como error estructural", () => {
    expect(
      extraerAvellaneda("<html><body><header>otro sitio</header></body></html>", LISTADO_BASE),
    ).toEqual([]);
  });
});

describe("parsearFechaAvellaneda", () => {
  const casos: Array<[string, string]> = [
    ["Mié 21 Oct 2026", "2026-10-21"],
    ["Lun 19 Oct 2026", "2026-10-19"],
    ["Sáb 19 dic 2026", "2026-12-19"],
    ["sab 3 ENE 2027", "2027-01-03"],
  ];

  for (const [entrada, esperado] of casos) {
    it(`"${entrada}" → ${esperado}`, () => {
      expect(parsearFechaAvellaneda(entrada)).toBe(esperado);
    });
  }

  const invalidos: Array<string | null> = [null, "", "sin fecha", "Mié 21 Foo 2026", "Mié 99 Oct 2026"];

  for (const entrada of invalidos) {
    it(`"${entrada}" → null`, () => {
      expect(parsearFechaAvellaneda(entrada)).toBeNull();
    });
  }
});
