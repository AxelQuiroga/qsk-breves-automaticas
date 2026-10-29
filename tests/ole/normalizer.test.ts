import { describe, expect, it } from "vitest";
import { normalizarNoticiasOle } from "../../src/ole/normalizer.ts";
import { ErrorOleFeed } from "../../src/ole/errors.ts";
import type { NoticiaOleCandidata } from "../../src/ole/types.ts";

const base: NoticiaOleCandidata = {
  titulo: "  Boca   ganó  ",
  url: "https://www.ole.com.ar/futbol/boca.html?utm_source=rss",
  pubDate: "Thu, 29 Oct 2026 00:47:58 +0000",
  imagenUrl: "https://www.ole.com.ar/images/boca.jpg",
  descripcion: null,
};

describe("normalizarNoticiasOle", () => {
  it("normaliza título, URL canónica, fecha y contrato público", () => {
    expect(normalizarNoticiasOle([base])).toEqual([{
      id: "https://www.ole.com.ar/futbol/boca.html",
      title: "Boca ganó",
      url: "https://www.ole.com.ar/futbol/boca.html",
      publishedAt: "2026-10-29T00:47:58.000Z",
      imageUrl: "https://www.ole.com.ar/images/boca.jpg",
      description: null,
      source: "Olé",
    }]);
  });


  it("conserva la descripción extraída y normaliza una descripción ausente a null", () => {
    const conDescripcion = normalizarNoticiasOle([{
      ...base,
      descripcion: "Resumen de la noticia",
    }])[0];
    const sinDescripcion = normalizarNoticiasOle([base])[0];

    expect(conDescripcion).toMatchObject({ description: "Resumen de la noticia" });
    expect(sinDescripcion).toMatchObject({ description: null });
  });

  it("deduplica por URL canónica y conserva la primera entrada válida", () => {
    expect(normalizarNoticiasOle([base, { ...base, titulo: "Titular duplicado", url: "https://www.ole.com.ar/futbol/boca.html" }])).toHaveLength(1);
  });

  it("descarta título vacío y URL externa, e ignora una imagen externa", () => {
    const result = normalizarNoticiasOle([
      { ...base, titulo: "  " },
      { ...base, url: "https://example.com/nota" },
      { ...base, imagenUrl: "https://example.com/image.jpg" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.imageUrl).toBeNull();
  });

  it.each([
    "http://www.ole.com.ar/nota.html",
    "javascript:alert(1)",
    "//www.ole.com.ar/nota.html",
    "https://ole.com.ar.evil.example/nota.html",
    "https://evil.example/www.ole.com.ar/nota.html",
    "https://www.ole.com.ar@evil.example/nota.html",
  ])("descarta enlaces no seguros o fuera del dominio permitido: %s", (url) => {
    expect(() => normalizarNoticiasOle([{ ...base, url }])).toThrowError(
      expect.objectContaining({ categoria: "normalizacion" }),
    );
  });

  it("elimina parámetros de tracking sin alterar otros parámetros útiles", () => {
    const result = normalizarNoticiasOle([{
      ...base,
      url: "https://www.ole.com.ar/nota.html?id=123&utm_campaign=deportes&fbclid=abc&seccion=futbol#destino",
    }]);
    expect(result[0]?.url).toBe("https://www.ole.com.ar/nota.html?id=123&seccion=futbol");
  });

  it("conserva fecha e imagen como null cuando faltan o la fecha es inválida", () => {
    expect(normalizarNoticiasOle([{ ...base, pubDate: "fecha rota", imagenUrl: null }])[0]).toMatchObject({
      publishedAt: null,
      imageUrl: null,
    });
  });

  it("ordena por fecha descendente y limita el resultado a diez", () => {
    const candidates = Array.from({ length: 12 }, (_, i) => ({
      ...base,
      titulo: `Noticia ${i}`,
      url: `https://www.ole.com.ar/noticias/${i}.html`,
      pubDate: new Date(Date.UTC(2026, 9, 29, i)).toUTCString(),
    }));
    const result = normalizarNoticiasOle(candidates);
    expect(result).toHaveLength(10);
    expect(result[0]?.title).toBe("Noticia 11");
    expect(result.at(-1)?.title).toBe("Noticia 2");
  });

  it("rechaza una tanda sin noticias válidas con error tipado", () => {
    try {
      normalizarNoticiasOle([{ ...base, titulo: "", url: "https://example.com" }]);
      throw new Error("Se esperaba que la normalización fallara");
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorOleFeed);
      expect(error).toMatchObject({ categoria: "normalizacion" });
    }
  });
});
