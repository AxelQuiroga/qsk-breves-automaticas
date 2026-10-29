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
    });
  });

  it("tolera campos opcionales ausentes sin inventarlos", () => {
    const xml = '<rss version="2.0"><channel><title>Olé</title><item><title><![CDATA[ Titular ]]></title><link>https://www.ole.com.ar/deportes/nota.html</link></item></channel></rss>';
    expect(parsearFeedOle(xml)).toEqual([{
      titulo: "Titular",
      url: "https://www.ole.com.ar/deportes/nota.html",
      pubDate: null,
      imagenUrl: null,
    }]);
  });

  it.each(["", "<html><body>Cloudflare</body></html>", "<rss><channel><item>"]) (
    "rechaza XML vacío, HTML inesperado o XML roto (%s)", (xml) => {
      expect(() => parsearFeedOle(xml)).toThrow();
    },
  );

  it("rechaza un feed válido sin noticias", () => {
    expect(() => parsearFeedOle("<rss version=\"2.0\"><channel><title>Olé</title></channel></rss>")).toThrow();
  });
});
