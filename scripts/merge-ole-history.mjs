import { readFile, writeFile } from "node:fs/promises";
import { combinarHistorialOle } from "../src/ole/history.ts";

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
