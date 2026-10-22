import { describe, expect, it } from "vitest";
import { completarFuentes, LIMITE_POR_FUENTE, fuentePorId, type NoticiaConFuente } from "../src/fuentes.ts";
import {
  verificarHistorialCompletoPorFuente,
  verificarHistorialCompleto,
} from "../src/historial.ts";
import type { Noticia } from "../src/types/noticia.ts";

function noticia(urlNoticia: string, fuente?: string): Noticia {
  return {
    titulo: `Título ${urlNoticia}`,
    descripcion: null,
    imagenUrl: null,
    urlNoticia,
    fecha: null,
    volanta: null,
    ...(fuente ? { fuente } : {}),
  };
}

describe("completarFuentes", () => {
  it("backfill determinista por dominio para el histórico sin fuente", () => {
    const completadas = completarFuentes([
      noticia("https://www.gba.gob.ar/gacetilla-a/"),
      noticia("https://www.lanus.gob.ar/noticias/4625-x/"),
      noticia("https://www.mda.gob.ar/noticias/y/"),
      noticia("https://www.estebanecheverria.gob.ar/z/"),
    ]);

    expect(completadas.map((noticia) => noticia.fuente)).toEqual([
      "gba",
      "lanus",
      "avellaneda",
      "esteban-echeverria",
    ]);
  });

  it("es idempotente con registros que ya declaran la fuente correcta", () => {
    const declarada = noticia("https://www.gba.gob.ar/a/", "gba");
    const completadas = completarFuentes([declarada]);

    expect(completadas).toHaveLength(1);
    expect(completadas[0]).toBe(declarada);
  });

  it("lanza si el dominio no pertenece a ninguna fuente registrada", () => {
    expect(() => completarFuentes([noticia("https://www.otromunicipio.gob.ar/n/1/")])).toThrow(
      /no pertenece a ninguna fuente registrada/,
    );
  });

  it("lanza si la fuente declarada no coincide con el dominio de la URL", () => {
    expect(() =>
      completarFuentes([noticia("https://www.gba.gob.ar/a/", "lanus")]),
    ).toThrow(/Inconsistencia/);
  });

  it("registra el limite por fuente en 12 (decisión aprobada)", () => {
    expect(LIMITE_POR_FUENTE).toBe(12);
    expect(fuentePorId("lanus")?.dominio).toBe("www.lanus.gob.ar");
  });
});

describe("verificarHistorialCompletoPorFuente", () => {
  it("acepta cuando cada fuente conserva todos sus registros históricos", () => {
    const anteriores: Array<NoticiaConFuente> = completarFuentes([
      noticia("https://www.gba.gob.ar/na1/"),
      noticia("https://www.gba.gob.ar/na2/"),
      noticia("https://www.lanus.gob.ar/noticias/1-x/"),
    ]);
    const resultado: Array<NoticiaConFuente> = [
      noticia("https://www.lanus.gob.ar/noticias/2-nueva/", "lanus") as NoticiaConFuente,
      ...anteriores,
    ];

    expect(() => verificarHistorialCompletoPorFuente(resultado, anteriores)).not.toThrow();
    expect(() => verificarHistorialCompleto(resultado, anteriores)).not.toThrow();
  });

  it("lanza en la fuente que pierde registros, aunque otras fuentes agreguen", () => {
    const anteriores: Array<NoticiaConFuente> = completarFuentes([
      noticia("https://www.gba.gob.ar/na1/"),
      noticia("https://www.lanus.gob.ar/noticias/1-x/"),
    ]);
    // fake resultado que conserva gba pero pierde la nota de Lanús:
    const resultado = anteriores.filter(
      (n) => n.urlNoticia !== "https://www.lanus.gob.ar/noticias/1-x/",
    );

    expect(() => verificarHistorialCompletoPorFuente(resultado, anteriores)).toThrow(
      /fuente "lanus"/,
    );
  });

  it("backfilllea el histórico sin fuente antes de agrupar (no pierde por clasificar mal)", () => {
    // Histórico previo a la migración: sin campo fuente.
    const anteriores: Noticia[] = [
      noticia("https://www.gba.gob.ar/na1/"),
      noticia("https://www.gba.gob.ar/na2/"),
    ];
    const resultado: Array<NoticiaConFuente> = [
      noticia("https://www.lanus.gob.ar/noticias/2-nueva/", "lanus") as NoticiaConFuente,
      ...anteriores.map((noticia) => ({ ...noticia, fuente: "gba" })) as Array<NoticiaConFuente>,
    ];

    expect(() => verificarHistorialCompletoPorFuente(resultado, anteriores)).not.toThrow();
  });
});
