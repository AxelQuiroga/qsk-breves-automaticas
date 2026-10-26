import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { correrExtraccion } from "../src/motor.ts";
import { extraerLanus } from "../src/extractor/lanus.ts";
import { extraerAvellaneda } from "../src/extractor/avellaneda.ts";
import { FUENTES } from "../src/listado-fuentes.ts";
import type { FuenteEjecutable } from "../src/fuentes.ts";

const base = new URL("./fixtures/", import.meta.url);
const LANUS_LISTADO = readFileSync(new URL("lanus-listado.html", base), "utf8");
const AV_LISTADO = readFileSync(new URL("avellaneda-listado.html", base), "utf8");
const LANUS_IND = readFileSync(new URL("lanus-noticia.html", base), "utf8");
const AV_IND = readFileSync(new URL("avellaneda-noticia.html", base), "utf8");

function fetchConDetalles(cuerpos: Record<string, string>) {
  return vi.fn<typeof fetch>(async (url) => {
    const cuerpo = cuerpos[url as string];
    if (cuerpo === undefined) throw new TypeError(`no body ${String(url)}`);
    return new Response(cuerpo, { status: 200, headers: { "content-type": "text/html" } });
  });
}

describe("correrExtraccion enriquece descripciones", () => {
  it("Lanús y Avellaneda obtienen descripcion desde la pagina individual", async () => {
    const lanusUrls = [...LANUS_LISTADO.matchAll(/href="(https:\/\/www\.lanus\.gob\.ar\/noticias\/[^"]+)"/g)].map((m) => m[1]!);
    const avUrls = [...new Set(AV_LISTADO.matchAll(/href="(https:\/\/www\.mda\.gob\.ar\/noticias\/[^"]+)"/g).map((m) => m[1]!))];

    const cuerpos: Record<string, string> = {
      "https://www.lanus.gob.ar/noticias": LANUS_LISTADO,
      "https://www.mda.gob.ar/noticias/": AV_LISTADO,
    };
    for (const u of lanusUrls) cuerpos[u] = LANUS_IND;
    for (const u of avUrls) cuerpos[u] = AV_IND;

    const fuentes = FUENTES.filter((f) => f.id === "lanus" || f.id === "avellaneda") as FuenteEjecutable[];
    const corrida = await correrExtraccion({
      fuentes,
      fetchFn: fetchConDetalles(cuerpos),
      dormir: async () => {},
      intentos: 1,
      timeoutMs: 5000,
    });

    expect(corrida.estado).toBe("ok");
    const lanus = corrida.nuevas.filter((n) => n.fuente === "lanus");
    const av = corrida.nuevas.filter((n) => n.fuente === "avellaneda");
    expect(lanus.some((n) => typeof n.descripcion === "string" && n.descripcion.length > 0)).toBe(true);
    expect(av.some((n) => typeof n.descripcion === "string" && n.descripcion.length > 0)).toBe(true);
  });
});