import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const URL_LISTADO_LANUS = "https://www.lanus.gob.ar/noticias";

export interface OpcionesFetchLanus {
  fetchFn?: typeof fetch;
  curlFn?: (url: string) => Promise<string>;
}

/**
 * Usa fetch normalmente y activa curl-impersonate únicamente si el listado
 * oficial de Lanús responde 403. El ejecutable se instala en el workflow.
 */
export function crearFetchLanusConFallback(
  opciones: OpcionesFetchLanus = {},
): typeof fetch {
  const fetchNormal = opciones.fetchFn ?? fetch;
  const descargarConCurl = opciones.curlFn ?? descargarConCurlImpersonate;

  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    const destino = new URL(url);

    const respuesta = await fetchNormal(input, init);
    if (
      respuesta.status !== 403 ||
      destino.hostname !== "www.lanus.gob.ar" ||
      destino.pathname !== "/noticias"
    ) {
      return respuesta;
    }

    console.warn("[Lanús] fetch recibió HTTP 403; activando curl-impersonate (Chrome 152).");
    const html = await descargarConCurl(URL_LISTADO_LANUS);
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }) as typeof fetch;
}

async function descargarConCurlImpersonate(url: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "curl_chrome152",
    [
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "35",
      "--write-out",
      "\\nQSK_HTTP_STATUS:%{http_code}",
      url,
    ],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 40_000 },
  );

  const marcador = /\nQSK_HTTP_STATUS:(\d{3})$/.exec(stdout);
  if (!marcador) {
    throw new Error("curl-impersonate no devolvió el código HTTP esperado.");
  }
  const codigo = Number(marcador[1]);
  if (codigo !== 200) {
    throw new Error(`curl-impersonate respondió HTTP ${codigo} para el listado de Lanús.`);
  }

  const html = stdout.slice(0, marcador.index);
  if (!html.trim()) {
    throw new Error("curl-impersonate devolvió el listado de Lanús vacío.");
  }
  return html;
}
