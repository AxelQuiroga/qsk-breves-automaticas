import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../data/gacetillas-fuente.html", import.meta.url), "utf8");
const json = JSON.parse(await readFile(new URL("../data/gacetillas.json", import.meta.url), "utf8"));

let ok = 0;
for (const n of json) {
  if (html.includes(n.titulo)) {
    ok++;
  } else {
    console.log("NO literal:", JSON.stringify(n.titulo));
  }
}
console.log(`títulos presentes en el HTML crudo: ${ok}/${json.length}`);

// Caso 1: doble espacio real en el HTML, colapsado en el JSON.
const doble = "La muestra “Vidas submarinas”  comienza";
console.log("HTML crudo contiene doble espacio:", html.includes(doble));
const vidas = json.find((n) => n.titulo.includes("Vidas submarinas"));
console.log("JSON normalizado a un espacio:", JSON.stringify(vidas?.titulo));

// Caso 2: comillas rectas + acentos.
const kicillof = json.find((n) => n.titulo.startsWith("Kicillof: \""));
console.log("título con comillas rectas copiado tal cual:", JSON.stringify(kicillof?.titulo));

// NBSP real en bajada (tarjeta Juegos Bonaerenses termina en ".\n&nbsp;\n").
const juegos = json.find((n) => n.titulo.includes("Juegos Bonaerenses"));
console.log("bajada sin NBSP residual:", !juegos?.descripcion?.includes("\u00A0"), "| fin:", JSON.stringify(juegos?.descripcion?.slice(-30)));

// Entidades HTML decodificadas.
const marcha = json.find((n) => n.titulo.includes("Marcha Federal"));
console.log("entidad &nbsp; decodificada en Marcha Federal:", JSON.stringify(marcha?.descripcion?.slice(0, 40)));
