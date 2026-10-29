import { readFile, writeFile } from "node:fs/promises";

const TRACKING = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;

/** URL canónica usada únicamente para deduplicar, sin modificar la URL publicada. */
export function canonicalizarUrlOle(valor) {
  try {
    const url = new URL(valor);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.href;
  } catch {
    return valor.trim();
  }
}

/**
 * Combina el historial append-only con la extracción reciente.
 * Las noticias existentes conservan su URL/identidad; los metadatos más nuevos
 * actualizan el registro. El resultado no depende del orden de entrada.
 */
export function combinarHistorialOle(historial, recientes) {
  const porUrl = new Map();
  for (const noticia of [...historial, ...recientes]) {
    const clave = canonicalizarUrlOle(noticia.url);
    const anterior = porUrl.get(clave);
    porUrl.set(clave, anterior ? { ...anterior, ...noticia, id: anterior.id || noticia.id } : noticia);
  }

  return [...porUrl.values()].sort((a, b) => {
    if (a.publishedAt === null && b.publishedAt !== null) return 1;
    if (a.publishedAt !== null && b.publishedAt === null) return -1;
    if (a.publishedAt && b.publishedAt && a.publishedAt !== b.publishedAt) {
      return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    }
    return a.url.localeCompare(b.url);
  });
}

async function main() {
  const [rutaRecientes, rutaHistorial] = process.argv.slice(2);
  if (!rutaRecientes || !rutaHistorial) {
    throw new Error("Uso: node scripts/merge-ole-history.mjs <recientes.json> <historial.json>");
  }

  const recientes = JSON.parse(await readFile(rutaRecientes, "utf8"));
  let historial = [];
  try {
    historial = JSON.parse(await readFile(rutaHistorial, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const combinado = combinarHistorialOle(historial, recientes);
  await writeFile(rutaHistorial, JSON.stringify(combinado, null, 2) + "\n", "utf8");
  console.log(`Historial de Olé: ${historial.length} previas + ${recientes.length} recientes = ${combinado.length} noticias únicas.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
