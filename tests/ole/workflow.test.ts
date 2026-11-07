import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/ole-rss.yml", import.meta.url),
);
const gitignorePath = fileURLToPath(new URL("../../.gitignore", import.meta.url));

describe("contrato del workflow de Olé hacia QSK Noticias", () => {
  it("programa una ejecución cada seis horas y permite ejecución manual", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toMatch(/on:\s*schedule:\s*\n\s+- cron: "41 \*\/6 \* \* \*"/);
    expect(workflow).toContain('cron: "41 */6 * * *"');
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it("mantiene permisos mínimos en el token del repositorio extractor", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(workflow).not.toMatch(/permissions:[\s\S]*?pull-requests: write/);
    expect(workflow).toContain("peter-evans/create-pull-request@v7");
  });

  it("copia solo el feed de Olé al repositorio del sitio mediante el token existente", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("repository: AxelQuiroga/QSK-Noticias");
    expect(workflow).toContain("ref: master");
    expect(workflow).toContain("token: ${{ secrets.QSK_NOTICIAS_TOKEN }}");
    expect(workflow).toContain("path: qsk-noticias");
    expect(workflow).toContain("cp data/ole-noticias.json qsk-noticias/src/data/ole.json");
    expect(workflow).toContain("add-paths: src/data/ole.json");
    expect(workflow).toContain("branch: automation/ole-rss");
    expect(workflow).toContain("base: master");
    expect(workflow).not.toContain("add-paths: data/ole-noticias.json");
  });

  it("mantiene la ejecución de publicación limitada a main", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow.match(/if: github.ref == 'refs\/heads\/main'/g)).toHaveLength(3);
  });

  it("no escribe ni referencia el historial de gacetillas", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).not.toContain("gacetillas-historial.json");
    expect(workflow).not.toContain("data/gacetillas.json");
    expect(workflow).toContain("Este PR solo modifica el archivo del feed de Olé; no toca las gacetillas oficiales.");
  });

  it("permite versionar el JSON de Olé sin designorar otros JSON", async () => {
    const gitignore = await readFile(gitignorePath, "utf8");

    expect(gitignore).toMatch(/^data\/\*\.json$/m);
    expect(gitignore).toMatch(/^!data\/ole-noticias\.json$/m);
    expect(gitignore).toMatch(/^!data\/gacetillas-historial\.json$/m);
  });
});
