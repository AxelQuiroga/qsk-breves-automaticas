import { describe, expect, it } from "vitest";
import { validarFeedOle } from "../../scripts/validar-feed-ole.ts";

const registroAntiguo = {
  id: "https://www.ole.com.ar/nota.html",
  title: "Noticia de prueba",
  url: "https://www.ole.com.ar/nota.html",
  publishedAt: null,
  imageUrl: null,
  source: "Olé",
};

describe("validarFeedOle", () => {
  it("acepta registros anteriores sin el campo description", () => {
    expect(() => validarFeedOle([registroAntiguo])).not.toThrow();
  });

  it.each([null, "Resumen de la noticia"])(
    "acepta description como %s",
    (description) => {
      expect(() => validarFeedOle([{ ...registroAntiguo, description }])).not.toThrow();
    },
  );

  it.each([42, true, {}, [], ["texto"]])(
    "rechaza description con tipo inválido: %j",
    (description) => {
      expect(() => validarFeedOle([{ ...registroAntiguo, description }])).toThrow();
    },
  );

  it("rechaza campos desconocidos y mantiene la validación exacta del contrato", () => {
    expect(() => validarFeedOle([{ ...registroAntiguo, campoExtra: "no" }])).toThrow();
  });

  it("mantiene los controles de identificador, fuente, título, URL y metadatos", () => {
    expect(() => validarFeedOle([{ ...registroAntiguo, id: "https://www.ole.com.ar/otra.html" }])).toThrow();
    expect(() => validarFeedOle([{ ...registroAntiguo, source: "Otra fuente" }])).toThrow();
    expect(() => validarFeedOle([{ ...registroAntiguo, title: "   " }])).toThrow();
    expect(() => validarFeedOle([{ ...registroAntiguo, url: "https://example.com/nota.html" }])).toThrow();
    expect(() => validarFeedOle([{ ...registroAntiguo, publishedAt: 123 }])).toThrow();
    expect(() => validarFeedOle([{ ...registroAntiguo, imageUrl: false }])).toThrow();
  });

  it("mantiene el límite de entre una y diez noticias", () => {
    expect(() => validarFeedOle([])).toThrow();
    expect(() => validarFeedOle(Array.from({ length: 11 }, (_, i) => ({
      ...registroAntiguo,
      id: `https://www.ole.com.ar/${i}.html`,
      url: `https://www.ole.com.ar/${i}.html`,
    })))).toThrow();
  });
});
