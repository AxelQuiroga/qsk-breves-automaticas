/**
 * Genera el cuerpo dinámico de la PR de QSK Noticias a partir del estado de
 * la corrida (data/estado-corrida.json) y el dataset persistido
 * (data/gacetillas.json).
 *
 * Uso: node scripts/generar-body-pr.mjs qsk-noticias/.pr-body.md
 * (la ruta de salida vive DENTRO del checkout de QSK pero fuera de los
 * paths commiteados por la action; add-paths limita el commit al dataset).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { METADATOS_FUENTES } from "../src/fuentes.ts";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const rutaSalida = process.argv[2] ?? `${raiz}data/pr-body.md`;

const estado = JSON.parse(readFileSync(`${raiz}data/estado-corrida.json`, "utf8"));
const dataset = JSON.parse(readFileSync(`${raiz}data/gacetillas.json`, "utf8"));
if (!Array.isArray(dataset)) throw new Error("data/gacetillas.json no es un array.");

const nombrePorId = new Map(METADATOS_FUENTES.map((fuente) => [fuente.id, fuente.nombre]));
const porFuente = new Map();
for (const noticia of dataset) {
  porFuente.set(noticia.fuente, (porFuente.get(noticia.fuente) ?? 0) + 1);
}

const lineas = [];
if (estado.estado === "parcial") {
  lineas.push("## Corrida PARCIAL de extracción de gacetillas", "");
  lineas.push("Algunas fuentes fallaron; las sanas aportaron datos y persisten con su historial intacto. Revisar antes de fusionar.", "");
} else {
  lineas.push("## Corrida de extracción de gacetillas", "");
}

lineas.push("| Fuente | Estado | Extraídas | Novedades reales | Error |");
lineas.push("| --- | --- | --- | --- | --- |");
for (const fuente of estado.fuentes ?? []) {
  const nombre = nombrePorId.get(fuente.id) ?? fuente.id;
  const categoriaError = fuente.categoriaError ?? "-";
  const mensajeError = fuente.estado === "error" ? `${categoriaError}: ${fuente.mensajeError ?? ""}` : "-";
  lineas.push(
    `| ${nombre} | ${fuente.estado} | ${fuente.extraidas ?? 0} | ${fuente.nuevasReales ?? 0} | ${mensajeError} |`,
  );
}
lineas.push("");
lineas.push(`- Dataset (historial completo): **${dataset.length} gacetillas** de ${porFuente.size} fuentes.`);
for (const [fuente, cantidad] of porFuente) {
  lineas.push(`  - ${nombrePorId.get(fuente) ?? fuente}: ${cantidad}`);
}
lineas.push("");

lineas.push(`- Estado de la corrida: ${estado.estado}${estado.exitCode !== undefined ? ` (exit ${estado.exitCode})` : ""}.`);
lineas.push("- El dataset es el historial completo: los registros existentes nunca se eliminan, las novedades se agregan al frente.");
lineas.push("- El slug de cada URL individual (/gacetillas-oficiales/<slug>/) se asigna una sola vez y no cambia.");
lineas.push("- El portal muestra las últimas 12 en la sección global y por fuente; el resto queda disponible en el archivo.");
lineas.push("- Cada tarjeta conserva su enlace a la publicación original.");
lineas.push("- Cada registro declara `fuente` validada contra el dominio de su URL.");

writeFileSync(rutaSalida, lineas.join("\n") + "\n", "utf8");
console.log(`Cuerpo de PR generado en ${rutaSalida}`);
