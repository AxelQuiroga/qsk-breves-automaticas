import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsearFeedOle } from "../../src/ole/parser.ts";

const fixture = fileURLToPath(new URL("../fixtures/ole-feed.xml", import.meta.url));
const xmlReal = await readFile(fixture, "utf8");

describe("parsearFeedOle", () => {
  it("parsea el fixture real de Olé sin acceder a la red", () => {
    const items = parsearFeedOle(xmlReal);
    expect(items).toHaveLength(10);
    expect(items[0]).toMatchObject({
      titulo: expect.stringContaining("Palermo y Falcioni"),
      url: "https://www.ole.com.ar/copa-argentina/palermo-falcioni-reencuentro-salta-copa-argentina-platense-atletico-tucuman_0_lkjPJ5l8Vv.html",
      pubDate: "Thu, 29 Oct 2026 00:47:58 +0000",
      imagenUrl: "https://www.ole.com.ar/images/2026/10/29/vKhC6UY5a_1200x630__1.jpg",
      descripcion: "Antes del inicio del partido entre A. Tucumán y Platense, el Loco y el Emperador se saludaron afectuosamente.",
    });
  });

  it("tolera campos opcionales ausentes sin inventarlos", () => {
    const xml = '<rss version="2.0"><channel><title>Olé</title><item><title><![CDATA[ Titular ]]></title><link>https://www.ole.com.ar/deportes/nota.html</link></item></channel></rss>';
    expect(parsearFeedOle(xml)).toEqual([{
      titulo: "Titular",
      url: "https://www.ole.com.ar/deportes/nota.html",
      pubDate: null,
      imagenUrl: null,
      descripcion: null,
    }]);
  });


  it("extrae la descripción como texto plano y elimina etiquetas y contenido ejecutable", () => {
    const xml = `<rss version="2.0"><channel><title>Olé</title><item>
      <title>Nota segura</title><link>https://www.ole.com.ar/deportes/nota.html</link>
      <description><![CDATA[<p>Texto <strong>importante</strong>.</p><script>alert("xss")</script><img src=x onerror="alert(1)">]]></description>
    </item></channel></rss>`;
    expect(parsearFeedOle(xml)[0]?.descripcion).toBe("Texto importante.");
  });

  it.each(["", "<html><body>Cloudflare</body></html>", "<rss><channel><item>"]) (
    "rechaza XML vacío, HTML inesperado o XML roto (%s)", (xml) => {
      expect(() => parsearFeedOle(xml)).toThrowError(
        expect.objectContaining({ name: "ErrorOleFeed", categoria: "xml-invalido" }),
      );
    },
  );

  it("rechaza etiquetas con anidamiento inválido aunque los conteos de apertura y cierre coincidan", () => {
    const xml = '<rss version="2.0"><channel><item><title>Nota</title></channel></item></rss>';
    expect(() => parsearFeedOle(xml)).toThrowError(
      expect.objectContaining({ name: "ErrorOleFeed", categoria: "xml-invalido" }),
    );
  });

  it("rechaza un RSS truncado aunque el parser XML tolerante pudiera recuperarlo", () => {
    const xml = '<rss version="2.0"><channel><title>Olé</title><item><title>Nota</title><link>https://www.ole.com.ar/nota.html</link></item></channel>';
    expect(() => parsearFeedOle(xml)).toThrowError(
      expect.objectContaining({ categoria: "xml-invalido" }),
    );
  });

  it("clasifica como feed-vacio un canal válido sin noticias", () => {
    expect(() => parsearFeedOle("<rss version=\"2.0\"><channel><title>Olé</title></channel></rss>")).toThrowError(
      expect.objectContaining({ name: "ErrorOleFeed", categoria: "feed-vacio" }),
    );
  });

  it("clasifica como feed-vacio items sin título o enlace utilizables", () => {
    const xml = '<rss version="2.0"><channel><item><title>Sin enlace</title></item><item><link>https://www.ole.com.ar/nota.html</link></item></channel></rss>';
    expect(() => parsearFeedOle(xml)).toThrowError(
      expect.objectContaining({ categoria: "feed-vacio" }),
    );
  });
});
