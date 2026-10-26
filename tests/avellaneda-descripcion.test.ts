import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerDescripcionAvellaneda } from "../src/extractor/avellaneda.ts";

const NOTICIA = readFileSync(
  new URL("./fixtures/avellaneda-noticia.html", import.meta.url),
  "utf8",
);

describe("extraerDescripcionAvellaneda", () => {
  it("obtiene la descripcion desde el h2 bajada", () => {
    expect(extraerDescripcionAvellaneda(NOTICIA)).toBe(
      "Nuestros representantes cosecharon 35 medallas de Oro, 12 de Plata y 10 de Bronce.",
    );
  });

  it("normaliza espacios", () => {
    const html = `<html><body><h1>Título</h1><h2>  Hola   mundo  </h2></body></html>`;
    expect(extraerDescripcionAvellaneda(html)).toBe("Hola mundo");
  });

  it("devuelve null cuando el h2 esta vacio", () => {
    const html = `<html><body><h1>Título</h1><h2>   </h2></body></html>`;
    expect(extraerDescripcionAvellaneda(html)).toBeNull();
  });

  it("devuelve null cuando el h2 coincide con el titulo", () => {
    const html = `<html><body><h1>Título</h1><h2>Título</h2></body></html>`;
    expect(extraerDescripcionAvellaneda(html)).toBeNull();
  });

  it("no usa el cuerpo completo como descripcion", () => {
    const resultado = extraerDescripcionAvellaneda(NOTICIA);
    expect(resultado).not.toContain("Durante esta semana");
  });

  it("maneja HTML incompleto sin lanzar", () => {
    expect(extraerDescripcionAvellaneda("<html><body>")).toBeNull();
  });
});