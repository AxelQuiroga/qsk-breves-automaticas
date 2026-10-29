import { readFile } from "node:fs/promises";

const CAMPOS_ANTIGUOS = ["id", "imageUrl", "publishedAt", "source", "title", "url"];
const CAMPOS_ACTUALES = [...CAMPOS_ANTIGUOS, "description"].sort();
const HOSTS_PERMITIDOS = new Set(["ole.com.ar", "www.ole.com.ar"]);

/**
 * Valida el contrato del feed. Acepta registros históricos sin description,
 * pero cuando el campo existe solo admite null o texto.
 */
export function validarFeedOle(noticias: unknown): void {
  if (!Array.isArray(noticias) || noticias.length === 0 || noticias.length > 10) {
    throw new Error("El feed debe contener entre 1 y 10 noticias.");
  }

  for (const [indice, noticia] of noticias.entries()) {
    if (noticia === null || typeof noticia !== "object" || Array.isArray(noticia)) {
      throw new Error(`Contrato de campos inválido en la noticia ${indice}.`);
    }

    const registro = noticia as Record<string, unknown>;
    const campos = Object.keys(registro).sort();
    const esContratoAntiguo = JSON.stringify(campos) === JSON.stringify(CAMPOS_ANTIGUOS);
    const esContratoActual = JSON.stringify(campos) === JSON.stringify(CAMPOS_ACTUALES);
    if (!esContratoAntiguo && !esContratoActual) {
      throw new Error(`Contrato de campos inválido en la noticia ${indice}.`);
    }

    if (
      registro.id !== registro.url ||
      typeof registro.url !== "string" ||
      !HOSTS_PERMITIDOS.has(new URL(registro.url).hostname) ||
      typeof registro.title !== "string" ||
      registro.title.trim() === "" ||
      registro.source !== "Olé" ||
      !(registro.publishedAt === null || typeof registro.publishedAt === "string") ||
      !(registro.imageUrl === null || typeof registro.imageUrl === "string") ||
      (Object.hasOwn(registro, "description") &&
        !(registro.description === null || typeof registro.description === "string"))
    ) {
      throw new Error(`Datos inválidos en la noticia ${indice}.`);
    }
  }
}

async function main(): Promise<void> {
  const path = process.argv[2] ?? "data/ole-noticias.json";
  const noticias: unknown = JSON.parse(await readFile(path, "utf8"));
  validarFeedOle(noticias);
  console.log(`Contrato válido: ${noticias.length} noticias de Olé.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
