import { describe, expect, it, vi } from "vitest";
import { descargarFeedOle, ErrorOleFeed, OLE_RSS_URL } from "../../src/ole/client.ts";

function response(status: number, body = "<rss><channel><item/></channel></rss>", contentType = "text/xml; charset=utf-8"): Response {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

const noWait = async () => {};

describe("descargarFeedOle", () => {
  it("usa la URL verificada y cabeceras XML con un User-Agent de navegador", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(response(200, "<rss/>"));
    const result = await descargarFeedOle({ fetchFn, dormir: noWait });
    expect(result.html).toBe("<rss/>");
    expect(fetchFn).toHaveBeenCalledWith(OLE_RSS_URL, expect.objectContaining({ headers: expect.anything() }));
    const init = fetchFn.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("User-Agent")).toMatch(/Chrome/);
    expect(headers.get("User-Agent")).not.toMatch(/Googlebot/i);
    expect(headers.get("Accept")).toContain("application/xml");
  });

  it("clasifica HTTP 403 como acceso denegado y no reintenta", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(response(403, "<html>Cloudflare</html>", "text/html"));
    await expect(descargarFeedOle({ fetchFn, dormir: noWait })).rejects.toMatchObject({
      name: "ErrorOleFeed",
      categoria: "acceso-denegado",
      status: 403,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("reintenta errores de red de forma acotada y devuelve error tipado", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(descargarFeedOle({ fetchFn, dormir: noWait, intentos: 2 })).rejects.toMatchObject({
      name: "ErrorOleFeed",
      categoria: "red",
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("clasifica content-type no XML como respuesta inválida", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(response(200, "blocked", "text/html"));
    await expect(descargarFeedOle({ fetchFn, dormir: noWait })).rejects.toMatchObject({
      name: "ErrorOleFeed",
      categoria: "respuesta-invalida",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("exporta errores tipados", () => {
    const error = new ErrorOleFeed("fallo", "red");
    expect(error).toBeInstanceOf(Error);
    expect(error.categoria).toBe("red");
  });
});
