import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workflowPath = fileURLToPath(
  new URL("../../.github/workflows/ole-rss.yml", import.meta.url),
);
const gitignorePath = fileURLToPath(new URL("../../.gitignore", import.meta.url));

describe("contrato del workflow independiente de Olé", () => {
  it("programa una ejecución cada seis horas y permite ejecución manual", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain('on:\n  schedule:\n    - cron: "41 */6 * * *"');
    expect(workflow).toContain('cron: "41 */6 * * *"');
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it("tiene permisos acotados para publicar una rama y abrir PR", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toMatch(/permissions:\s*\n\s*contents: write\s*\n\s*pull-requests: write/);
    expect(workflow).toContain("peter-evans/create-pull-request@v7");
  });

  it("usa una rama y un archivo exclusivos, sin tocar las gacetillas", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("branch: automation/ole-rss");
    expect(workflow).toContain("base: main");
    expect(workflow).toContain("add-paths: data/ole-noticias.json");
    expect(workflow).toContain("pnpm ole");
    expect(workflow).not.toContain("gacetillas-historial.json");
    expect(workflow).not.toContain("QSK_NOTICIAS_TOKEN");
  });

  it("solo permite crear PR cuando se ejecuta desde main", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  });

  it("permite versionar el JSON de Olé sin designorar otros JSON", async () => {
    const gitignore = await readFile(gitignorePath, "utf8");

    expect(gitignore).toMatch(/^data\/\*\.json$/m);
    expect(gitignore).toMatch(/^!data\/ole-noticias\.json$/m);
    expect(gitignore).toMatch(/^!data\/gacetillas-historial\.json$/m);
  });
});
