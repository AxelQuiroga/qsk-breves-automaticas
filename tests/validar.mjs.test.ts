import { describe, expect, it } from "vitest";
import { validarDataset } from "../scripts/validar.mjs";
import type { Noticia } from "../src/types/noticia.ts";

function noticia(url: string, parcial: Partial<Noticia> = {}): Noticia {
  return {
    titulo: `Título ${url}`,
    descripcion: null,
    imagenUrl: null,
    urlNoticia: url,
    fecha: null,
    volanta: null,
    slug: url.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    ...parcial,
  };
}

function datasetEjemplo(): Noticia[] {
  return [
    noticia("https://www.gba.gob.ar/gacetilla-unica/", { fuente: "gba", slug: "gacetilla-unica" }),
    noticia("https://www.lanus.gob.ar/noticias/4625-x", { fuente: "lanus", slug: "lanus-4625-x" }),
  ];
}

describe("validarDataset", () => {
  it("acepta un dataset válido aunque tenga UN solo registro (no hay mínimo universal de 12)", () => {
    const resumen = validarDataset(
      [noticia("https://www.gba.gob.ar/unica/", { fuente: "gba", slug: "unica" })],
      [],
    );

    expect(resumen.total).toBe(1);
    expect(resumen.porFuente).toEqual({ gba: 1 });
  });

  it("rechaza registros sin fuente", () => {
    expect(() => validarDataset(datasetEjemplo().map((n) => ({ ...n, fuente: undefined })), [])).toThrow(
      /"fuente" es requerido/,
    );
  });

  it("rechaza una fuente que no coincide con el dominio de la URL", () => {
    expect(() =>
      validarDataset(
        [noticia("https://www.gba.gob.ar/x/", { fuente: "lanus", slug: "x" })],
        [],
      ),
    ).toThrow(/no coincide con el dominio/);
  });

  it("rechaza una fuente no registrada", () => {
    expect(() =>
      validarDataset(
        [noticia("https://www.otromunicipio.gob.ar/x/", { fuente: "otro", slug: "x" })],
        [],
      ),
    ).toThrow(/fuente registrada/);
  });

  it("rechaza URLs duplicadas", () => {
    const dataset = datasetEjemplo();
    dataset.push(noticia("https://www.gba.gob.ar/gacetilla-unica/", { fuente: "gba", slug: "otro-slug" }));

    expect(() => validarDataset(dataset, [])).toThrow(/URL duplicada/);
  });

  it("rechaza slugs duplicados", () => {
    const dataset = datasetEjemplo();
    // primera entrada ya lleva "gacetilla-unica":
    dataset.push(noticia("https://www.gba.gob.ar/otra/", { fuente: "gba", slug: "gacetilla-unica" }));

    expect(() => validarDataset(dataset, [])).toThrow(/Slug duplicado/);
  });

  it("rechaza slugs inválidos", () => {
    expect(() =>
      validarDataset(
        [noticia("https://www.gba.gob.ar/x/", { fuente: "gba", slug: "Con Espacios" })],
        [],
      ),
    ).toThrow(/slug inválido/i);
  });

  it("rechaza fechas no ISO", () => {
    expect(() =>
      validarDataset(
        [noticia("https://www.lanus.gob.ar/noticias/1", { fuente: "lanus", fecha: "21/10/2026" })],
        [],
      ),
    ).toThrow(/fecha inválida/);
  });

  it("acepta fecha ISO y null indistintamente", () => {
    const dataset = [
      noticia("https://www.lanus.gob.ar/noticias/1", { fuente: "lanus", fecha: "2026-10-21", slug: "a" }),
      noticia("https://www.lanus.gob.ar/noticias/2", { fuente: "lanus", fecha: null, slug: "b" }),
    ];
    expect(validarDataset(dataset, []).total).toBe(2);
  });

  it("rechaza un dataset vacío", () => {
    expect(() => validarDataset([], [])).toThrow(/al menos una gacetilla/);
  });

  it("conserva el historial: una previa que desaparece provoca error nombrando la fuente", () => {
    const previas = [
      noticia("https://www.lanus.gob.ar/noticias/4620-vieja", { fuente: "lanus", slug: "vieja" }),
    ];

    expect(() => validarDataset(datasetEjemplo(), previas)).toThrow(
      /"lanus".*4620-vieja|4620-vieja/s,
    );
  });

  it("backfill del histórico sin fuente por dominio antes de comparar", () => {
    // Histórico previo a la migración: sin campo fuente ni slug derivado nuevo.
    const previas: Noticia[] = [
      {
        titulo: "Histórica",
        descripcion: null,
        imagenUrl: null,
        urlNoticia: "https://www.gba.gob.ar/historica/",
        fecha: null,
        volanta: null,
        slug: "historica",
      },
    ];

    const dataset = datasetEjemplo();
    dataset.unshift(noticia("https://www.gba.gob.ar/historica/", { fuente: "gba" }));

    expect(validarDataset(dataset, previas).total).toBe(3);
  });

  it("rechaza un histórico con dominio no registrado (no se puede garantizar su conservación)", () => {
    const previas = [noticia("https://www.otromunicipio.gob.ar/vieja/", {})];

    expect(() => validarDataset(datasetEjemplo(), previas)).toThrow(/dominio no registrado/);
  });
});
