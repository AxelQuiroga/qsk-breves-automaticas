import { describe, expect, it } from "vitest";
import type { Noticia } from "../src/types/noticia.ts";
import { combinarHistorial } from "../src/historial.ts";

function noticia(id: number): Noticia {
  return {
    titulo: `Gacetilla ${id}`,
    descripcion: null,
    imagenUrl: null,
    urlNoticia: `https://www.gba.gob.ar/gacetilla-${id}`,
    fecha: null,
    volanta: null,
  };
}

describe("combinarHistorial", () => {
  it("combina 6 nuevas con 6 anteriores hasta completar 12", () => {
    const nuevas = Array.from({ length: 6 }, (_, i) => noticia(i + 13));
    const anteriores = Array.from({ length: 12 }, (_, i) => noticia(i + 1));

    const resultado = combinarHistorial(nuevas, anteriores);

    expect(resultado).toHaveLength(12);
    expect(resultado.map((n) => n.urlNoticia)).toEqual([
      ...nuevas.map((n) => n.urlNoticia),
      ...anteriores.slice(0, 6).map((n) => n.urlNoticia),
    ]);
  });

  it("combina 2 nuevas con las 10 anteriores más recientes", () => {
    const nuevas = [noticia(13), noticia(14)];
    const anteriores = Array.from({ length: 12 }, (_, i) => noticia(i + 1));

    const resultado = combinarHistorial(nuevas, anteriores);

    expect(resultado).toHaveLength(12);
    expect(resultado.slice(2).map((n) => n.urlNoticia)).toEqual(
      anteriores.slice(0, 10).map((n) => n.urlNoticia),
    );
  });

  it("mantiene las anteriores si no aparecen gacetillas nuevas", () => {
    const anteriores = Array.from({ length: 12 }, (_, i) => noticia(i + 1));

    expect(combinarHistorial([], anteriores)).toEqual(anteriores);
  });

  it("prioriza los datos recién extraídos y elimina URLs duplicadas", () => {
    const anterior = noticia(1);
    const actualizada = { ...anterior, titulo: "Título actualizado" };

    const resultado = combinarHistorial([actualizada], [anterior, noticia(2)]);

    expect(resultado).toHaveLength(2);
    expect(resultado[0]?.titulo).toBe("Título actualizado");
  });

  it("respeta un límite menor y rechaza límites inválidos", () => {
    const anteriores = Array.from({ length: 5 }, (_, i) => noticia(i + 1));

    expect(combinarHistorial(anteriores, [], 3)).toHaveLength(3);
    expect(() => combinarHistorial([], [], 0)).toThrow();
  });
});
