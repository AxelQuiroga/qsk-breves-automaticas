import { readFile, writeFile } from "node:fs/promises";
import { CloudflareWorkersAiProvider } from "./provider.ts";
import { rewriteDescription } from "./engine.ts";

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] ?? "editorial-output.json";
  if (!inputPath) {
    console.error("Uso: node src/editorial/cli.ts <entrada.json> [salida.json]");
    process.exitCode = 1;
    return;
  }

  const raw = await readFile(inputPath, "utf8");
  const input = JSON.parse(raw);

  const provider = new CloudflareWorkersAiProvider();
  const result = await rewriteDescription(input, { provider });

  await writeFile(outputPath, JSON.stringify(result.output, null, 2) + "\n", "utf8");
  console.log(`OK: ${result.field} reescrita en ${outputPath}`);
  console.log(`Original: ${result.originalDescription}`);
  console.log(`Nueva:    ${result.description}`);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
