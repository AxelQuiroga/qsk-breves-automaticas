import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerEstebanEcheverria } from "../src/extractor/echeverria.ts";

const FEED = readFileSync(
  new URL("./fixtures/echeverria-feed.xml", import.meta.url),
  "utf8",
);
const BASE = "https://www.estebanecheverria.gob.ar/feed/";

const URL_BACHEO =
  "https://www.estebanecheverria.gob.ar/nuevos-trabajos-de-bacheo-sobre-la-ruta-58-en-canning/";
const URL_PASEOS =
  "https://www.estebanecheverria.gob.ar/volvio-el-programa-paseos-de-compras-a-las-plazas-del-municipio/";
const URL_BARRIALES =
  "https://www.estebanecheverria.gob.ar/abrieron-las-inscripciones-para-los-centros-de-atencion-barrial/";

describe("extraerEstebanEcheverria", () => {
  it("extrae los items del feed descartando duplicados por URL e items sin título", () => {
    const noticias = extraerEstebanEcheverria(FEED, BASE);

    expect(noticias).toHaveLength(3);
    expect(noticias.map((noticia) => noticia.urlNoticia)).toEqual([
      URL_BACHEO,
      URL_PASEOS,
      URL_BARRIALES,
    ]);
  });

  it("mapea los campos del item: fecha en hora local AR, imagen/volanta null, fuente", () => {
    const noticias = extraerEstebanEcheverria(FEED, BASE);
    const bacheo = noticias[0];

    expect(bacheo?.titulo).toBe("NUEVOS TRABAJOS DE BACHEO SOBRE LA RUTA 58, EN CANNING");
    expect(bacheo?.fecha).toBe("2026-10-20");
    expect(bacheo?.descripcion).toContain("plan integral de infraestructura");
    // Decisión aprobada: el feed no trae imágenes; no se navega cada artículo.
    expect(bacheo?.imagenUrl).toBeNull();
    expect(bacheo?.volanta).toBeNull();
    expect(bacheo?.fuente).toBe("esteban-echeverria");
  });

  it("convierte el pubDate a la fecha del día en America/Argentina/Buenos_Aires", () => {
    const noticias = extraerEstebanEcheverria(FEED, BASE);
    const paseos = noticias.find((noticia) => noticia.urlNoticia === URL_PASEOS);

    // 18 Oct 2026 22:33 UTC == 18 Oct 19:33 en Argentina.
    expect(paseos?.fecha).toBe("2026-10-18");
  });

  it("un pubDate cerca de medianoche UTC cae en el día local de Argentina", () => {
    const xml = [
      "<rss><channel>",
      "<item><title>PRUEBA DE MADIANOCHE UTC</title>",
      "<link>https://www.estebanecheverria.gob.ar/prueba-medianouche/</link>",
      "<pubDate>Wed, 21 Oct 2026 02:00:00 +0000</pubDate>",
      "</item>",
      "</channel></rss>",
    ].join("");
    const [noticia] = extraerEstebanEcheverria(xml, BASE);

    // 21 Oct 02:00 UTC == 20 Oct 23:00 en Argentina.
    expect(noticia?.fecha).toBe("2026-10-20");
  });

  it("los CDATA de description llegan como texto normalizado", () => {
    const noticias = extraerEstebanEcheverria(FEED, BASE);

    expect(noticias[0]?.descripcion).toBe(
      "Como parte del plan integral de infraestructura, avanza el bacheo sobre la Ruta 58 y calles aledañas.",
    );
  });

  it("item sin description produce descripcion null (no string vacía)", () => {
    const noticias = extraerEstebanEcheverria(FEED, BASE);
    const sinResumen = noticias.find((noticia) => noticia.urlNoticia === URL_BARRIALES);

    expect(sinResumen?.descripcion).toBeNull();
  });

  it("pubDate inválida produce fecha null", () => {
    const xml = [
      "<rss><channel>",
      '<item><title>FECHA RARA</title>',
      "<link>https://www.estebanecheverria.gob.ar/fecha-rara/</link>",
      "<pubDate>ayer por la tarde</pubDate>",
      "</item>",
      "</channel></rss>",
    ].join("");
    const [noticia] = extraerEstebanEcheverria(xml, BASE);

    expect(noticia?.fecha).toBeNull();
  });

  it("un feed sin items devuelve []: el motor lo marca como error estructural", () => {
    expect(extraerEstebanEcheverria("<rss><channel></channel></rss>", BASE)).toEqual([]);
  });

  it("un XML roto devuelve [] (leniente); el guard estructural vive en el motor", () => {
    expect(extraerEstebanEcheverria("<<< rss >>> no-es-xml", BASE)).toEqual([]);
  });

  it("resuelve links relativos contra la URL base del feed", () => {
    const xml = [
      "<rss><channel>",
      "<item><title>LINK RELATIVO</title>",
      "<link>/link-relativo/</link>",
      "</item>",
      "</channel></rss>",
    ].join("");
    const [noticia] = extraerEstebanEcheverria(xml, BASE);

    expect(noticia?.urlNoticia).toBe("https://www.estebanecheverria.gob.ar/link-relativo/");
  });
});
