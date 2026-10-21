import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { extraerGacetillas } from "../src/extractor/gacetillas.ts";

const URL_BASE = "https://www.gba.gob.ar/comunicacion_publica/gacetillas";
const FIXTURE = new URL("./fixtures/gacetillas-listado.html", import.meta.url);

const html = await readFile(FIXTURE, "utf8");
const noticias = extraerGacetillas(html, URL_BASE);

describe("extraerGacetillas (fixture del listado real)", () => {
  it("descarta el duplicado: 6 tarjetas en el HTML, 5 noticias", () => {
    expect(noticias).toHaveLength(5);
  });

  it("extrae título, bajada, imagen y URL absoluta de una tarjeta real completa", () => {
    expect(noticias[0]).toEqual({
      titulo: "Kicillof entregó viviendas a familias de Tristán Suárez",
      descripcion:
        "Además, el Gobernador inauguró la Casa de la Provincia y las nuevas instalaciones de la base del Grupo Halcón.",
      imagenUrl: "https://www.gba.gob.ar/sites/default/files/comunicacion_publica/imagenes/Axel%20Kicillof_221.jpg",
      urlNoticia:
        "https://www.gba.gob.ar/comunicacion_publica/gacetillas/kicillof_entreg%C3%B3_viviendas_familias_de_trist%C3%A1n_su%C3%A1rez",
      fecha: null,
      volanta: "EZEIZA",
    });
  });

  it("normaliza comillas tipográficas, doble espacio, espacios de la volanta y NBSP en la bajada (regresión)", () => {
    const muestra = noticias[1];
    expect(muestra?.titulo).toBe(
      "La muestra “Vidas submarinas” comienza su recorrido por la provincia",
    );
    expect(muestra?.volanta).toBe("CIENCIA Y CULTURA");
    // La bajada real contiene "y&nbsp;continuará": el NBSP debe colapsar a espacio simple.
    expect(muestra?.descripcion).toBe(
      "Del 13 al 22 de octubre la muestra podrá visitarse con entrada libre y gratuita en la Casa de la Cultura de Adrogué, y continuará su recorrido por Escobar, Tandil, General San Martín y Luján.",
    );
  });

  it("resuelve la URL relativa del título contra la URL base", () => {
    expect(noticias[2]?.urlNoticia).toBe(
      "https://www.gba.gob.ar/comunicacion_publica/gacetillas/kicillof_particip%C3%B3_de_la_5%C2%B0_marcha_federal_universitaria",
    );
  });

  it("representa la imagen ausente como null (no como cadena vacía ni error)", () => {
    const sinImagen = noticias.find((n) => n.titulo === "Noticia sin imagen");
    expect(sinImagen).toBeDefined();
    expect(sinImagen?.imagenUrl).toBeNull();
    expect(sinImagen?.descripcion).toBe(
      "Bajada de una tarjeta que no tiene campo de imagen.",
    );
  });

  it("resuelve una imagen con src relativo contra la URL base", () => {
    const relativa = noticias.find((n) => n.titulo === "Noticia con imagen relativa");
    expect(relativa?.imagenUrl).toBe(
      "https://www.gba.gob.ar/sites/default/files/comunicacion_publica/imagenes/relativa.jpg",
    );
    // Esta tarjeta sintética no tiene bajada: también ausente, no inventada.
    expect(relativa?.descripcion).toBeNull();
  });

  it("deduplica por URL absoluta de la noticia", () => {
    const urls = noticias.map((n) => n.urlNoticia);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("siempre informa fecha como null: el listado real no expone fecha en las tarjetas", () => {
    expect(noticias.every((n) => n.fecha === null)).toBe(true);
  });
});

describe("extraerGacetillas (casos de borde)", () => {
  it("devuelve un array vacío ante HTML sin el contenedor de tarjetas", () => {
    expect(extraerGacetillas("<html><body><p>solo texto</p></body></html>", URL_BASE)).toEqual([]);
  });

  it("devuelve un array vacío ante HTML vacío", () => {
    expect(extraerGacetillas("", URL_BASE)).toEqual([]);
  });

  it("descarta tarjetas sin título o sin enlace en lugar de fabricar datos", () => {
    const htmlRoto = `
      <div id="org-medios-page-3" class="dexp-grid-items row">
        <div class="ds-1col node node-medios">
          <div class="field field-name-title"><h2><a href="/comunicacion_publica/gacetillas/solo_url">   </a></h2></div>
        </div>
        <div class="ds-1col node node-medios">
          <div class="field field-name-title"><h2><a>Sin href</a></h2></div>
        </div>
      </div>`;
    expect(extraerGacetillas(htmlRoto, URL_BASE)).toEqual([]);
  });
});
