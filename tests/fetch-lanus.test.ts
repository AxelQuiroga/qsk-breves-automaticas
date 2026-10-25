import { describe, expect, it, vi } from "vitest";
import { crearFetchLanusConFallback } from "../src/fetch-lanus.ts";

function respuesta(status: number, cuerpo = "<html></html>"): Response {
  return new Response(cuerpo, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

describe("crearFetchLanusConFallback", () => {
  it("usa curl-impersonate cuando el listado de Lanús devuelve 403", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respuesta(403, "blocked"));
    const curlFn = vi.fn().mockResolvedValue("<html><article>Noticia oficial</article></html>");
    const fetchLanus = crearFetchLanusConFallback({ fetchFn, curlFn });

    const resultado = await fetchLanus("https://www.lanus.gob.ar/noticias");

    expect(resultado.status).toBe(200);
    expect(await resultado.text()).toContain("Noticia oficial");
    expect(curlFn).toHaveBeenCalledWith("https://www.lanus.gob.ar/noticias");
  });

  it("no usa curl-impersonate para otras fuentes", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respuesta(403, "blocked"));
    const curlFn = vi.fn();
    const fetchLanus = crearFetchLanusConFallback({ fetchFn, curlFn });

    const resultado = await fetchLanus("https://www.gba.gob.ar/comunicacion_publica/gacetillas");

    expect(resultado.status).toBe(403);
    expect(curlFn).not.toHaveBeenCalled();
  });

  it("no usa curl-impersonate si Lanús responde distinto de 403", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respuesta(200, "<html>ok</html>"));
    const curlFn = vi.fn();
    const fetchLanus = crearFetchLanusConFallback({ fetchFn, curlFn });

    const resultado = await fetchLanus("https://www.lanus.gob.ar/noticias");

    expect(resultado.status).toBe(200);
    expect(curlFn).not.toHaveBeenCalled();
  });
});
