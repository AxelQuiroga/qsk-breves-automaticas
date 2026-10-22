import { afterEach, describe, expect, it, vi } from "vitest";
import {
  descargarConReintentos,
  ErrorExtraccion,
  TIPOS_RSS,
  type OpcionesDescarga,
} from "../src/red.ts";

function respuesta(contentType: string, cuerpo = "<html></html>", status = 200): Response {
  return new Response(cuerpo, {
    status,
    headers: { "content-type": contentType },
  });
}

const sinEsperaEsperable: OpcionesDescarga = { dormir: async () => {} };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("descargarConReintentos", () => {
  it("reintenta HTTP 5xx y resuelve cuando un intento sale OK", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(Object.assign(new Error("boom"), { name: "TypeError" }))
      .mockResolvedValueOnce(respuesta("text/html; charset=utf-8", "<h1>ok</h1>"));

    const resultado = await descargarConReintentos("https://ejemplo.ar/x", {
      ...sinEsperaEsperable,
      fetchFn,
    });

    expect(resultado.html).toBe("<h1>ok</h1>");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("agotados los reintentos de 5xx lanza ErrorExtraccion categoria red", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respuesta("text/plain", "x", 503));

    await expect(
      descargarConReintentos("https://ejemplo.ar/roto", { ...sinEsperaEsperable, fetchFn }),
    ).rejects.toMatchObject({
      name: "ErrorExtraccion",
      categoria: "red",
      message: expect.stringContaining("HTTP 503"),
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("HTTP 4xx NO se reintenta (categoria http, un solo intento)", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respuesta("text/plain", "x", 404));

    await expect(
      descargarConReintentos("https://ejemplo.ar/inexistente", {
        ...sinEsperaEsperable,
        fetchFn,
      }),
    ).rejects.toMatchObject({ categoria: "http" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("content-type inesperado NO se reintenta (categoria respuesta-invalida)", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(respuesta("application/pdf", "%PDF-1.4"));

    await expect(
      descargarConReintentos("https://ejemplo.ar/pdf", { ...sinEsperaEsperable, fetchFn }),
    ).rejects.toMatchObject({ categoria: "respuesta-invalida" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("espera entre intentos con backoff creciente (intento * 2000ms)", async () => {
    const esperas: Array<number> = [];
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(respuesta("text/plain", "x", 502));

    await expect(
      descargarConReintentos("https://ejemplo.ar/lento", {
        fetchFn,
        dormir: async (ms) => {
          esperas.push(ms);
        },
      }),
    ).rejects.toMatchObject({ categoria: "red" });

    expect(esperas).toEqual([2000, 4000]);
  });

  it("el timeout aborta el intento y se reintenta", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
      return new Promise<Response>((_resolver, rechazar) => {
        init?.signal?.addEventListener("abort", () =>
          rechazar(new DOMException("This operation was aborted", "AbortError")),
        );
      });
    });

    await expect(
      descargarConReintentos("https://ejemplo.ar/colgado", {
        ...sinEsperaEsperable,
        fetchFn,
        timeoutMs: 25,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("acepta feeds RSS con el listado de tipos de feed", async () => {
    const xml = "<rss><channel><item><title>x</title></item></channel></rss>";
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(respuesta("application/rss+xml; charset=UTF-8", xml));

    const resultado = await descargarConReintentos("https://ejemplo.ar/feed/", {
      ...sinEsperaEsperable,
      tiposAceptados: TIPOS_RSS,
      fetchFn,
    });

    expect(resultado.html).toBe(xml);
    // Fallback de src/red.ts: un Response manual tiene url vacía; en fetch
    // real `response.url` es la final y manda siempre.
    expect(resultado.urlBase).toBe("https://ejemplo.ar/feed/");
  });

  it("un error no-Error (string) no se reintenta", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue("cadena-fracasada");

    await expect(
      descargarConReintentos("https://ejemplo.ar/raro", { ...sinEsperaEsperable, fetchFn }),
    ).rejects.toBe("cadena-fracasada");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("ErrorExtraccion se exporta y mantiene su categoria", () => {
    const error = new ErrorExtraccion("mensaje", "estructural");
    expect(error).toBeInstanceOf(Error);
    expect(error.categoria).toBe("estructural");
  });
});
