import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { correrExtraccion, type OpcionesCorrida } from "../src/motor.ts";
import { extraerGacetillas } from "../src/extractor/gacetillas.ts";
import { extraerLanus } from "../src/extractor/lanus.ts";
import { extraerAvellaneda } from "../src/extractor/avellaneda.ts";
import { extraerEstebanEcheverria } from "../src/extractor/echeverria.ts";
import { FUENTES } from "../src/listado-fuentes.ts";
import type { Noticia } from "../src/types/noticia.ts";

const GBA_URL = "https://www.gba.gob.ar/comunicacion_publica/gacetillas";
const LANUS_URL = "https://www.lanus.gob.ar/noticias";
const MDA_URL = "https://www.mda.gob.ar/noticias/";
const EE_URL = "https://www.estebanecheverria.gob.ar/feed/";

const GBA_HTML = readFileSync(new URL("./fixtures/gacetillas-listado.html", import.meta.url), "utf8");
const LANUS_HTML = readFileSync(new URL("./fixtures/lanus-listado.html", import.meta.url), "utf8");
const MDA_HTML = readFileSync(new URL("./fixtures/avellaneda-listado.html", import.meta.url), "utf8");
const EE_XML = readFileSync(new URL("./fixtures/echeverria-feed.xml", import.meta.url), "utf8");

const EXTRACCIONES_BASE = {
  gba: extraerGacetillas(GBA_HTML, GBA_URL),
  lanus: extraerLanus(LANUS_HTML, LANUS_URL),
  avellaneda: extraerAvellaneda(MDA_HTML, MDA_URL),
  "esteban-echeverria": extraerEstebanEcheverria(EE_XML, EE_URL),
};

const CUERPOS_POR_URL: Record<string, string> = {
  [GBA_URL]: GBA_HTML,
  [LANUS_URL]: LANUS_HTML,
  [MDA_URL]: MDA_HTML,
  [EE_URL]: EE_XML,
};

const sinEspera = { dormir: async () => {}, intentos: 3 };

function fetchSegunMapa(cuerpos: Record<string, string>) {
  return vi.fn<typeof fetch>(async (url) => {
    const cuerpo = cuerpos[url as string];
    if (cuerpo === undefined) {
      throw new TypeError(`No hay cuerpo simulado para ${String(url)}`);
    }
    // EE es un feed RSS: su content-type verificado es application/rss+xml.
    const contentType = url === EE_URL ? "application/rss+xml; charset=UTF-8" : "text/html";
    return new Response(cuerpo, { status: 200, headers: { "content-type": contentType } });
  });
}

function historialDe(urls: Array<string>): Noticia[] {
  return urls.map((urlNoticia) => ({
    titulo: `Registro histórico: ${urlNoticia}`,
    descripcion: null,
    imagenUrl: null,
    urlNoticia,
    fecha: null,
    volanta: null,
  }));
}

function correr(opciones: OpcionesCorrida) {
  return correrExtraccion({ ...(sinEspera as Omit<OpcionesCorrida, "fuentes">), ...opciones });
}

/** HTML de GBA con N tarjetas (para probar el corte a 12). */
function listadoGbaCon(cantidad: number): string {
  const tarjetas = Array.from({ length: cantidad }, (_, i) => {
    const numero = String(i).padStart(2, "0");
    return `<div class="ds-1col node node-medios">
      <div class="field field-name-title field-type-ds"><h2><a href="/comunicacion_publica/gacetillas/prueba_cap_${numero}">Gacetilla de prueba ${numero}</a></h2></div>
    </div>`;
  });
  return `<html><body><div id="org-medios-page-3" class="dexp-grid-items">${tarjetas.join("")}</div></body></html>`;
}

describe("correrExtraccion", () => {
  it("corrida con todas las fuentes OK y sin novedades: estado ok, exit 0", async () => {
    const historial = historialDe(
      Object.values(EXTRACCIONES_BASE).flat().map((noticia) => noticia.urlNoticia),
    );
    const corrida = await correr({
      historial,
      fetchFn: fetchSegunMapa(CUERPOS_POR_URL),
    });

    expect(corrida.estado).toBe("ok");
    expect(corrida.exitCode).toBe(0);
    expect(corrida.fuentes.every((fuente) => fuente.estado === "ok")).toBe(true);
    for (const fuente of corrida.fuentes) {
      expect(fuente.nuevasReales).toBe(0);
    }
  });

  it("el orden de las novedades sigue el orden de registro de las fuentes", async () => {
    const corrida = await correr({ fetchFn: fetchSegunMapa(CUERPOS_POR_URL) });

    const dominios = corrida.nuevas.map((noticia) => new URL(noticia.urlNoticia).host);
    // Primer bloque gba; último bloque esteban-echeverria.
    expect(dominios[0]).toBe("www.gba.gob.ar");
    expect(dominios[dominios.length - 1]).toBe("www.estebanecheverria.gob.ar");
    expect(corrida.nuevas).toHaveLength(
      Object.values(EXTRACCIONES_BASE).reduce((total, lista) => total + lista.length, 0),
    );
  });

  it("cuenta novedades reales comparando contra el historial provisto", async () => {
    const todas = Object.values(EXTRACCIONES_BASE).flat().map((noticia) => noticia.urlNoticia);
    const primitivaLanus = EXTRACCIONES_BASE.lanus[0]?.urlNoticia;
    if (!primitivaLanus) throw new Error("El fixture de Lanús debe extraer al menos una nota.");
    const historial = historialDe(todas.filter((url) => url !== primitivaLanus));

    const corrida = await correr({ historial, fetchFn: fetchSegunMapa(CUERPOS_POR_URL) });

    const lanus = corrida.fuentes.find((fuente) => fuente.id === "lanus");
    expect(corrida.estado).toBe("ok");
    expect(lanus?.nuevasReales).toBe(1);
    expect(corrida.nuevas.map((noticia) => noticia.urlNoticia)).toContain(primitivaLanus);
  });

  it("una fuente caída NO invalida a las sanas: estado parcial, exit 2, novedades sin la fuente caída", async () => {
    const sinLanus: Record<string, string> = { ...CUERPOS_POR_URL };
    delete sinLanus[LANUS_URL];

    const corrida = await correr({ fetchFn: fetchSegunMapa(sinLanus) });

    expect(corrida.estado).toBe("parcial");
    expect(corrida.exitCode).toBe(2);
    const lanus = corrida.fuentes.find((fuente) => fuente.id === "lanus");
    expect(lanus?.estado).toBe("error");
    expect(lanus?.categoriaError).toBe("red");
    expect(lanus?.mensajeError).toContain("No hay cuerpo simulado");
    // Las sanas sí aportan datos:
    expect(corrida.nuevas.some((noticia) => noticia.urlNoticia.includes("www.gba.gob.ar"))).toBe(true);
    expect(corrida.nuevas.some((noticia) => noticia.urlNoticia.includes("www.lanus.gob.ar"))).toBe(false);
  });

  it("HTTP 200 con HTML cambiado es error ESTRUCTURAL (no cuenta como listado válido)", async () => {
    const gbaRota: Record<string, string> = { ...CUERPOS_POR_URL, [GBA_URL]: "<div>otra cosa</div>" };

    const corrida = await correr({ fetchFn: fetchSegunMapa(gbaRota) });

    expect(corrida.estado).toBe("parcial");
    const gba = corrida.fuentes.find((fuente) => fuente.id === "gba");
    expect(gba?.estado).toBe("error");
    expect(gba?.categoriaError).toBe("estructural");
    expect(gba?.mensajeError).toContain("devolvió 0 notas");
  });

  it("HTTP 200 con content-type inoperante es respuesta-invalida y no reintenta inútilmente", async () => {
    // GBA responde PDF; las demás fuentes responden con sus fixtures y
    // content-types correctos (RSS para EE).
    const fetchFx = vi.fn<typeof fetch>(async (url) => {
      const cuerpo = CUERPOS_POR_URL[url as string];
      if (url === GBA_URL) {
        return new Response("%PDF-1.4", { status: 200, headers: { "content-type": "application/pdf" } });
      }
      const contentType = url === EE_URL ? "application/rss+xml; charset=UTF-8" : "text/html";
      return new Response(cuerpo, { status: 200, headers: { "content-type": contentType } });
    });

    const corrida = await correr({ fetchFn: fetchFx });
    expect(corrida.estado).toBe("parcial");
    const gba = corrida.fuentes.find((fuente) => fuente.id === "gba");
    expect(gba?.categoriaError).toBe("respuesta-invalida");
    expect(gba?.extraidas).toBe(0);
    expect(corrida.nuevas.some((noticia) => noticia.urlNoticia.includes("www.lanus.gob.ar"))).toBe(true);
  });

  it("reintento que se recupera: 503 y luego OK deja la fuente en ok", async () => {
    let llamadasLanus = 0;
    const fetchFx = vi.fn<typeof fetch>(async (url) => {
      const cuerpo = CUERPOS_POR_URL[url as string];
      const contentType = url === EE_URL ? "application/rss+xml; charset=UTF-8" : "text/html";
      if (url === LANUS_URL) {
        llamadasLanus++;
        if (llamadasLanus === 1) {
          return new Response("Service Unavailable", { status: 503, headers: { "content-type": "text/plain" } });
        }
      }
      return new Response(cuerpo, { status: 200, headers: { "content-type": contentType } });
    });

    const corrida = await correr({ fetchFn: fetchFx });
    expect(corrida.estado).toBe("ok");
    expect(llamadasLanus).toBe(2);
    expect(corrida.fuentes.find((fuente) => fuente.id === "lanus")?.estado).toBe("ok");
  });

  it("con TODAS las fuentes caídas es falla-total, exit 1 y no hay novedades", async () => {
    const corrida = await correr({ fetchFn: fetchSegunMapa({}) });

    expect(corrida.estado).toBe("falla-total");
    expect(corrida.exitCode).toBe(1);
    expect(corrida.nuevas).toEqual([]);
    expect(corrida.fuentes.every((fuente) => fuente.estado === "error")).toBe(true);
  });

  it("corta a LIMITE_POR_FUENTE (12) aunque el listado traiga más", async () => {
    const gbaGrande = listadoGbaCon(14);
    const cuerpos: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(CUERPOS_POR_URL).filter(([url]) => url !== GBA_URL),
      ),
      [GBA_URL]: gbaGrande,
    };

    const corrida = await correr({ fetchFn: fetchSegunMapa(cuerpos) });

    const gba = corrida.fuentes.find((fuente) => fuente.id === "gba");
    expect(gba?.extraidas).toBe(14);
    expect(gba?.estado).toBe("ok");
    const urlsGba = corrida.nuevas
      .filter((noticia) => noticia.urlNoticia.includes("www.gba.gob.ar"))
      .map((noticia) => noticia.urlNoticia);
    expect(urlsGba).toHaveLength(12);
  });

  it("usa el registro completo por defecto (4 fuentes)", async () => {
    expect(FUENTES.map((fuente) => fuente.id)).toEqual([
      "gba",
      "lanus",
      "avellaneda",
      "esteban-echeverria",
    ]);
  });
});
