import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { generarArchivoOle } from "../../src/ole/generator.ts";
import type { Descarga } from "../../src/red.ts";

const fixture = fileURLToPath(new URL("../fixtures/ole-feed.xml", import.meta.url));
const xmlReal = await readFile(fixture, "utf8");

async function crearDestinoTemporal(): Promise<{ directorio: string; ruta: string }> {
  const directorio = await mkdtemp(join(tmpdir(), "ole-feed-"));
  return { directorio, ruta: join(directorio, "ole-noticias.json") };
}

function descarga(html: string): Descarga {
  return { html, urlBase: "https://www.ole.com.ar/rss/ultimas-noticias/" };
}

describe("generarArchivoOle", () => {
  it("persiste un array JSON con el contrato público OleNews", async () => {
    const temporal = await crearDestinoTemporal();
    try {
      const descargar = vi.fn(async () => descarga(xmlReal));
      await generarArchivoOle({ rutaSalida: temporal.ruta, descargar });

      const contenido: unknown = JSON.parse(await readFile(temporal.ruta, "utf8"));
      if (!Array.isArray(contenido)) throw new Error("El JSON de salida no es un array");
      expect(contenido).toHaveLength(10);
      expect(contenido[0]).toEqual({
        id: "https://www.ole.com.ar/copa-argentina/palermo-falcioni-reencuentro-salta-copa-argentina-platense-atletico-tucuman_0_lkjPJ5l8Vv.html",
        title: expect.stringContaining("Palermo y Falcioni"),
        url: "https://www.ole.com.ar/copa-argentina/palermo-falcioni-reencuentro-salta-copa-argentina-platense-atletico-tucuman_0_lkjPJ5l8Vv.html",
        publishedAt: "2026-10-29T00:47:58.000Z",
        imageUrl: "https://www.ole.com.ar/images/2026/10/29/vKhC6UY5a_1200x630__1.jpg",
        description: "Antes del inicio del partido entre A. Tucumán y Platense, el Loco y el Emperador se saludaron afectuosamente.",
        source: "Olé",
      });
      for (const registro of contenido as Record<string, unknown>[]) {
        expect(Object.keys(registro).sort()).toEqual([
          "description", "id", "imageUrl", "publishedAt", "source", "title", "url",
        ]);
        expect(registro.id).toBe(registro.url);
        expect(registro.source).toBe("Olé");
        expect(typeof registro.title).toBe("string");
        expect(typeof registro.url).toBe("string");
        expect(registro.publishedAt === null || typeof registro.publishedAt === "string").toBe(true);
        expect(registro.imageUrl === null || typeof registro.imageUrl === "string").toBe(true);
        expect(registro.description === null || typeof registro.description === "string").toBe(true);
      }
      expect(descargar).toHaveBeenCalledOnce();
    } finally {
      await rm(temporal.directorio, { recursive: true, force: true });
    }
  });

  it("no sobrescribe el JSON válido si falla la descarga", async () => {
    const temporal = await crearDestinoTemporal();
    const contenidoValido = JSON.stringify([{
      id: "https://www.ole.com.ar/nota.html",
      title: "Dato anterior",
      url: "https://www.ole.com.ar/nota.html",
      publishedAt: null,
      imageUrl: null,
      description: null,
      source: "Olé",
    }], null, 2) + "\n";
    try {
      await writeFile(temporal.ruta, contenidoValido, "utf8");
      const descargar = vi.fn(async (): Promise<Descarga> => {
        throw new Error("fallo de red simulado");
      });

      await expect(generarArchivoOle({ rutaSalida: temporal.ruta, descargar })).rejects.toThrow("fallo de red simulado");
      expect(await readFile(temporal.ruta, "utf8")).toBe(contenidoValido);
      expect(descargar).toHaveBeenCalledOnce();
    } finally {
      await rm(temporal.directorio, { recursive: true, force: true });
    }
  });

  it("no acumula duplicados de URL canónica en una misma tanda", async () => {
    const temporal = await crearDestinoTemporal();
    const xmlDuplicado = `<?xml version="1.0"?>
      <rss version="2.0"><channel><title>Olé</title>
        <item><title>Primera versión</title><link>https://www.ole.com.ar/futbol/boca.html?utm_source=rss</link><pubDate>Thu, 29 Oct 2026 00:47:58 +0000</pubDate></item>
        <item><title>Versión duplicada</title><link>https://www.ole.com.ar/futbol/boca.html</link><pubDate>Thu, 29 Oct 2026 00:47:58 +0000</pubDate></item>
      </channel></rss>`;
    try {
      await generarArchivoOle({
        rutaSalida: temporal.ruta,
        descargar: async () => descarga(xmlDuplicado),
      });

      const contenido: unknown = JSON.parse(await readFile(temporal.ruta, "utf8"));
      if (!Array.isArray(contenido)) throw new Error("El JSON de salida no es un array");
      expect(contenido).toHaveLength(1);
      expect(contenido).toMatchObject([{
        id: "https://www.ole.com.ar/futbol/boca.html",
        title: "Primera versión",
        url: "https://www.ole.com.ar/futbol/boca.html",
        source: "Olé",
      }]);
    } finally {
      await rm(temporal.directorio, { recursive: true, force: true });
    }
  });

  it("no sobrescribe el JSON válido si el RSS no se puede parsear", async () => {
    const temporal = await crearDestinoTemporal();
    const contenidoValido = '[{"source":"Olé"}]\n';
    try {
      await writeFile(temporal.ruta, contenidoValido, "utf8");
      await expect(generarArchivoOle({
        rutaSalida: temporal.ruta,
        descargar: async () => descarga("<html>bloqueo</html>"),
      })).rejects.toMatchObject({ name: "ErrorOleFeed", categoria: "xml-invalido" });
      expect(await readFile(temporal.ruta, "utf8")).toBe(contenidoValido);
    } finally {
      await rm(temporal.directorio, { recursive: true, force: true });
    }
  });
});
