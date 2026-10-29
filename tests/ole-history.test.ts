import { describe, expect, it } from "vitest";
import { canonicalizarUrlOle, combinarHistorialOle } from "../src/ole/history.ts";
import type { OleNews } from "../src/ole/types.ts";

const noticia = (url: string, title: string, publishedAt: string | null = "2026-10-29T10:00:00.000Z"): OleNews => ({
  id: url,
  title,
  url,
  publishedAt,
  imageUrl: null,
  source: "Olé",
});

describe("combinarHistorialOle", () => {
  it("conserva noticias anteriores que ya no aparecen en el feed reciente", () => {
    const vieja = noticia("https://www.ole.com.ar/futbol/nota-vieja.html", "Nota vieja", "2026-10-20T10:00:00.000Z");
    const nueva = noticia("https://www.ole.com.ar/futbol/nota-nueva.html", "Nota nueva");
    expect(combinarHistorialOle([vieja], [nueva])).toEqual([nueva, vieja]);
  });

  it("deduplica URLs equivalentes y actualiza metadatos con la extracción nueva", () => {
    const anterior = noticia("https://www.ole.com.ar/futbol/nota.html", "Título anterior");
    const actualizada = noticia("https://ole.com.ar/futbol/nota.html/?utm_source=rss#nota", "Título corregido");
    const resultado = combinarHistorialOle([anterior], [actualizada]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.title).toBe("Título corregido");
    expect(resultado[0]?.id).toBe(anterior.id);
  });

  it("ordena por fecha descendente y deja las fechas nulas al final", () => {
    const sinFecha = noticia("https://www.ole.com.ar/futbol/sin-fecha.html", "Sin fecha", null);
    const vieja = noticia("https://www.ole.com.ar/futbol/vieja.html", "Vieja", "2026-10-20T10:00:00.000Z");
    const nueva = noticia("https://www.ole.com.ar/futbol/nueva.html", "Nueva", "2026-10-29T10:00:00.000Z");
    expect(combinarHistorialOle([sinFecha, vieja], [nueva]).map((item) => item.title))
      .toEqual(["Nueva", "Vieja", "Sin fecha"]);
  });
});

describe("canonicalizarUrlOle", () => {
  it("ignora www, parámetros de tracking, fragmentos y barra final", () => {
    expect(canonicalizarUrlOle("https://www.ole.com.ar/futbol/nota.html/?utm_source=rss#nota"))
      .toBe(canonicalizarUrlOle("https://ole.com.ar/futbol/nota.html"));
  });
});
