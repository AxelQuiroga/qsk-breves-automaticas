// Descarga el HTML real de la página de gacetillas y guarda el resultado en data/.
// No es parte del extractor: es el paso de inspección de la fuente.

const SOURCE_URL = "https://www.gba.gob.ar/comunicacion_publica/gacetillas";
const OUT_FILE = new URL("../data/gacetillas-fuente.html", import.meta.url);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

try {
  const response = await fetch(SOURCE_URL, {
    signal: controller.signal,
    redirect: "follow",
  });

  console.log("status:", response.status, response.statusText);
  console.log("content-type:", response.headers.get("content-type"));
  console.log("final-url:", response.url);

  if (!response.ok) {
    console.error("Respuesta HTTP no exitosa; no se guarda el HTML.");
    process.exitCode = 1;
  } else {
    const html = await response.text();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(OUT_FILE, html, "utf8");
    console.log("bytes:", html.length);
    console.log("guardado en:", OUT_FILE.pathname);
  }
} catch (error) {
  console.error("Fallo de red:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
