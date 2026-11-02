import { mkdir, writeFile, readFile } from "node:fs/promises";
import { rewriteDescription, CloudflareWorkersAiProvider } from "../src/editorial/index.ts";

const dataset = [
  {
    titulo: "La Provincia entregó el premio Hebe Uhart de Novela 2026",
    descripcion: "La ceremonia fue encabezada por el gobernador. El concurso promueve la creatividad artística y fomenta la escritura y la producción cultural.",
  },
  {
    titulo: "Kicillof encabezó la presentación del programa “Empleo Verde Joven”",
    descripcion: "La iniciativa está destinada a promover la formación técnica y la inserción laboral de jóvenes en el sector de las energías renovables.",
  },
  {
    titulo: "Se entregó el crédito N°500.000 de Provincia Microcréditos",
    descripcion: "Fue en un encuentro encabezado por el gobernador. La empresa del Banco Provincia alcanzó este hito tras haber otorgado más de 260.000 préstamos en los últimos seis años.",
  },
];

const provider = new CloudflareWorkersAiProvider();
const outDir = new URL("../examples/prueba-real/", import.meta.url);
await mkdir(outDir, { recursive: true });

const resultados = [];
for (const [i, item] of dataset.entries()) {
  const registro = { indice: i + 1, original: item };
  try {
    const result = await rewriteDescription(item, { provider });
    registro.respuestaModelo = result.description;
    registro.final = result.output;
    registro.intentos = result.attempts;
  } catch (error) {
    registro.error = error instanceof Error ? error.message : String(error);
  }
  resultados.push(registro);
  await writeFile(new URL(`caso-${i + 1}.json`, outDir), JSON.stringify(registro, null, 2) + "\n", "utf8");
}
await writeFile(new URL("resumen.json", outDir), JSON.stringify(resultados, null, 2) + "\n", "utf8");
console.log("Prueba real finalizada. Resultados en examples/prueba-real/");
console.log(JSON.stringify(resultados, null, 2));
