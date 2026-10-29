import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parsearFeedOle } from "../src/ole/parser.ts";
import { normalizarNoticiasOle } from "../src/ole/normalizer.ts";
import { combinarHistorialOle } from "../src/ole/history.ts";
import { generarArchivoOle } from "../src/ole/generator.ts";
import type { OleNews } from "../src/ole/types.ts";

const xml = (description: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Olé</title>
<item><title>Noticia de prueba</title><link>https://www.ole.com.ar/futbol/noticia.html</link>
<pubDate>Thu, 29 Oct 2026 10:00:00 GMT</pubDate><enclosure url="https://www.ole.com.ar/imagen.jpg" type="image/jpeg"/>
${description}</item></channel></rss>`;

const noticia = (description?: string): OleNews => ({
  id: "https://www.ole.com.ar/futbol/noticia.html",
  title: "Noticia de prueba",
  url: "https://www.ole.com.ar/futbol/noticia.html",
  publishedAt: "2026-10-29T10:00:00.000Z",
  imageUrl: "https://www.ole.com.ar/imagen.jpg",
  source: "Olé",
  ...(description === undefined ? {} : { description }),
});

const directorios: string[] = [];
afterEach(async () => {
  await Promise.all(directorios.splice(0).map((directorio) => rm(directorio, { recursive: true, force: true })));
});

describe("description del RSS de Olé", () => {
  it("extrae una descripción XML escapada sin mezclarla con el título", () => {
    const [candidata] = parsearFeedOle(xml("<description>Resumen &amp; contexto</description>"));
    expect(candidata).toMatchObject({
      titulo: "Noticia de prueba",
      description: "Resumen & contexto",
      url: "https://www.ole.com.ar/futbol/noticia.html",
    });
  });

  it("admite descripción HTML dentro de CDATA", () => {
    const [candidata] = parsearFeedOle(xml("<description><![CDATA[<p>Resumen <strong>importante</strong> &amp; contexto</p>]]></description>"));
    expect(candidata?.description).toContain("<p>");
    const [normalizada] = normalizarNoticiasOle([candidata!]);
    expect(normalizada?.description).toBe("Resumen importante & contexto");
  });

  it.each(["", "   "])("tolera descripción vacía (%s)", (valor) => {
    const [candidata] = parsearFeedOle(xml(`<description>${valor}</description>`));
    expect(candidata?.description ?? null).toBeNull();
    const [normalizada] = normalizarNoticiasOle([candidata!]);
    expect(normalizada?.description).toBeUndefined();
  });

  it("tolera que description no exista", () => {
    const [candidata] = parsearFeedOle(xml(""));
    expect(candidata?.description ?? null).toBeNull();
    const [normalizada] = normalizarNoticiasOle([candidata!]);
    expect(normalizada?.description).toBeUndefined();
  });

  it("normaliza espacios y no altera título, fecha, URL ni imagen", () => {
    const [candidata] = parsearFeedOle(xml("<description>  Un   resumen\n con espacios  </description>"));
    const [normalizada] = normalizarNoticiasOle([candidata!]);
    expect(normalizada).toMatchObject({
      title: "Noticia de prueba",
      description: "Un resumen con espacios",
      publishedAt: "2026-10-29T10:00:00.000Z",
      url: "https://www.ole.com.ar/futbol/noticia.html",
      imageUrl: "https://www.ole.com.ar/imagen.jpg",
      source: "Olé",
    });
  });

  it("conserva la descripción histórica si una actualización no trae una útil", () => {
    const anterior = noticia("Descripción histórica útil");
    const reciente = noticia("   ");
    const [resultado] = combinarHistorialOle([anterior], [reciente]);
    expect(resultado?.description).toBe("Descripción histórica útil");
  });

  it("conserva registros históricos sin description", () => {
    const anterior = noticia();
    const reciente = noticia();
    expect(combinarHistorialOle([anterior], [reciente])).toHaveLength(1);
    expect(combinarHistorialOle([anterior], [reciente])[0]?.description).toBeUndefined();
  });

  it("transporta description desde el fixture hasta el JSON generado", async () => {
    const directorio = await mkdtemp(join(tmpdir(), "ole-description-"));
    directorios.push(directorio);
    const rutaSalida = join(directorio, "ole-noticias.json");
    const resultado = await generarArchivoOle({
      rutaSalida,
      descargar: async () => ({
        html: xml("<description><![CDATA[Resumen de extremo a extremo]]></description>"),
        urlBase: "https://www.ole.com.ar/rss/ultimas-noticias/",
      }),
    });
    const persistido = JSON.parse(await readFile(rutaSalida, "utf8")) as OleNews[];
    expect(resultado[0]?.description).toBe("Resumen de extremo a extremo");
    expect(persistido[0]?.description).toBe("Resumen de extremo a extremo");
  });
});
