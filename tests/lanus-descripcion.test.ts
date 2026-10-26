import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerDescripcionLanus } from "../src/extractor/lanus.ts";

const NOTICIA = readFileSync(
  new URL("./fixtures/lanus-noticia.html", import.meta.url),
  "utf8",
);

describe("extraerDescripcionLanus", () => {
  it("obtiene la descripcion del primer parrafo util de .texto", () => {
    expect(extraerDescripcionLanus(NOTICIA)).toBe(
      "Lanús Gobierno informa que el Colectivo Sanitario estará presente el miércoles 28, jueves 29 y viernes 30 de octubre, de 10 a 14, en la plaza Arias.",
    );
  });

  it("normaliza espacios y ignora parrafos vacios iniciales", () => {
    const html = `<html><body><h1>Título</h1><div class="texto"><p>&nbsp;</p><p>  Hola   mundo  </p></div></body></html>`;
    expect(extraerDescripcionLanus(html)).toBe("Hola mundo");
  });

  it("devuelve null cuando el texto coincide con el titulo", () => {
    const html = `<html><body><h1>Título</h1><div class="texto"><p>Título</p></div></body></html>`;
    expect(extraerDescripcionLanus(html)).toBeNull();
  });

  it("devuelve null cuando no hay parrafo descriptivo valido", () => {
    const html = `<html><body><h1>Título</h1><div class="texto"><p>&nbsp;</p></div></body></html>`;
    expect(extraerDescripcionLanus(html)).toBeNull();
  });

  it("no captura el cuerpo completo, solo el primer parrafo", () => {
    const resultado = extraerDescripcionLanus(NOTICIA);
    expect(resultado).not.toContain("Durante las tres jornadas");
  });

  it("maneja HTML incompleto sin lanzar", () => {
    expect(extraerDescripcionLanus("<html><body>")).toBeNull();
  });
});