import { generarArchivoOle } from "./generator.ts";

try {
  const noticias = await generarArchivoOle();
  console.log(`Feed de Olé actualizado: ${noticias.length} noticias en data/ole-noticias.json`);
} catch (error) {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error(`ERROR al actualizar el feed de Olé: ${mensaje}`);
  process.exitCode = 1;
}
