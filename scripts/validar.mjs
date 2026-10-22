/**
 * Validación del dataset antes de persistir el historial o actualizar QSK.
 *
 * Regla central (decisión aprobada): NO existe mínimo universal de 12 por
 * fuente. La verificación de calidad es estructural (fuente requerida y
 * consistente con el dominio de la URL, URLs/slugs únicos, formato de fecha
 * ISO) más preservación de cada registro histórico POR FUENTE.
 *
 * Estados de corrida aceptados: solo "ok" y "parcial". "falla-total" y
 * "en-curso" (crash a mitad del proceso) no validan nada.
 *
 * Uso: node scripts/validar.mjs   (exit 0 válido / 1 inválido)
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { METADATOS_FUENTES } from "../src/fuentes.ts";

const SLUG_VALIDO = /^[a-z0-9-]+$/;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function dominioDe(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Valida el dataset. `previas` es el historial anterior (registrado en
 * git HEAD). Lanza con un mensaje descriptivo ante cualquier violación;
 * si pasa, devuelve un resumen de conteos por fuente.
 */
export function validarDataset(noticias, previas = []) {
  if (!Array.isArray(noticias) || noticias.length === 0) {
    throw new Error("El dataset debe ser un array JSON con al menos una gacetilla.");
  }

  const dominioAId = new Map(METADATOS_FUENTES.map((fuente) => [fuente.dominio, fuente.id]));
  const idsValidos = new Set(METADATOS_FUENTES.map((fuente) => fuente.id));

  const urlsActuales = new Set();
  const slugsActuales = new Set();
  const urlsPorFuente = new Map();

  noticias.forEach((noticia, indice) => {
    const etiqueta = `noticia[${indice}] (${noticia.urlNoticia ?? "sin URL"})`;

    if (typeof noticia.titulo !== "string" || noticia.titulo.trim() === "") {
      throw new Error(`${etiqueta}: título ausente o vacío.`);
    }

    const dominio = dominioDe(noticia.urlNoticia);
    if (!dominio) {
      throw new Error(`${etiqueta}: URL inválida.`);
    }

    if (typeof noticia.fuente !== "string" || !idsValidos.has(noticia.fuente)) {
      throw new Error(
        `${etiqueta}: el campo "fuente" es requerido y debe ser una fuente registrada ` +
          `(recibido: ${JSON.stringify(noticia.fuente)}).`,
      );
    }

    const fuenteEsperada = dominioAId.get(dominio);
    if (fuenteEsperada !== noticia.fuente) {
      throw new Error(
        `${etiqueta}: la fuente declarada "${noticia.fuente}" no coincide con el dominio ` +
          `${dominio} (esperado: "${fuenteEsperada ?? "fuente no registrada"}").`,
      );
    }

    if (noticia.fecha !== null && noticia.fecha !== undefined) {
      if (typeof noticia.fecha !== "string" || !FECHA_ISO.test(noticia.fecha)) {
        throw new Error(`${etiqueta}: fecha inválida (${JSON.stringify(noticia.fecha)}); esperado ISO YYYY-MM-DD o null.`);
      }
    }

    if (typeof noticia.slug !== "string" || !SLUG_VALIDO.test(noticia.slug)) {
      throw new Error(`${etiqueta}: slug inválido o ausente.`);
    }

    if (urlsActuales.has(noticia.urlNoticia)) {
      throw new Error(`URL duplicada en el dataset: ${noticia.urlNoticia}`);
    }
    urlsActuales.add(noticia.urlNoticia);

    if (slugsActuales.has(noticia.slug)) {
      throw new Error(`Slug duplicado en el dataset: ${noticia.slug}`);
    }
    slugsActuales.add(noticia.slug);

    const registro = urlsPorFuente.get(noticia.fuente) ?? new Set();
    registro.add(noticia.urlNoticia);
    urlsPorFuente.set(noticia.fuente, registro);
  });

  // Preservación por fuente: cada URL histórica debe seguir presente,
  // bajo la MISMA fuente. Los registros históricos sin `fuente` se
  // backfilllean por dominio igual que hace el extractor.
  for (const previa of previas) {
    const dominio = dominioDe(previa.urlNoticia);
    const fuente = previa.fuente ?? (dominio ? dominioAId.get(dominio) : undefined);
    if (!fuente) {
      throw new Error(
        `Registro histórico con dominio no registrado: ${previa.urlNoticia}. ` +
          "No se puede garantizar su preservación; se cancela la persistencia.",
      );
    }
    const actualesDeLaFuente = urlsPorFuente.get(fuente);
    if (!actualesDeLaFuente || !actualesDeLaFuente.has(previa.urlNoticia)) {
      throw new Error(
        `El resultado eliminaría una gacetilla de la fuente "${fuente}": ${previa.urlNoticia}. ` +
          "Se cancela la persistencia para no perder registros históricos.",
      );
    }
  }

  const porFuente = Object.fromEntries(
    [...urlsPorFuente.entries()].map(([fuente, urls]) => [fuente, urls.size]),
  );
  return { total: noticias.length, porFuente };
}

function leerHistorialPrevio() {
  try {
    const salida = execSync("git show HEAD:data/gacetillas-historial.json", { encoding: "utf8" });
    return JSON.parse(salida);
  } catch {
    return [];
  }
}

/** CLI principal del paso de validación del workflow. */
export function main() {
  const raiz = fileURLToPath(new URL("..", import.meta.url));

  const rutaEstado = `${raiz}data/estado-corrida.json`;
  if (!existsSync(rutaEstado)) {
    throw new Error("No existe data/estado-corrida.json: la corrida no llegó a registrar estado. No se persiste nada.");
  }
  const estado = JSON.parse(readFileSync(rutaEstado, "utf8"));
  if (estado.estado !== "ok" && estado.estado !== "parcial") {
    throw new Error(
      `Estado de corrida no aceptado: "${estado.estado}". ` +
        "Solo ok/parcial persisten; falla-total y en-curso no validan.",
    );
  }

  const rutaDataset = `${raiz}data/gacetillas.json`;
  if (!existsSync(rutaDataset)) {
    throw new Error("No existe data/gacetillas.json. No hay dataset que validar.");
  }
  const noticias = JSON.parse(readFileSync(rutaDataset, "utf8"));
  const previas = leerHistorialPrevio();

  const resumen = validarDataset(noticias, previas);
  console.log(`Resultado validado: ${resumen.total} gacetillas, sin pérdidas respecto del historial.`);
  for (const [fuente, cantidad] of Object.entries(resumen.porFuente)) {
    console.log(`  - ${fuente}: ${cantidad}`);
  }
  if (estado.estado === "parcial") {
    console.warn("Corrida PARCIAL: algunas fuentes fallaron y conservan su historial intacto. Ver logs del paso de extracción.");
  }
}

const ejecutadoDirecto =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (ejecutadoDirecto) {
  main();
}
