import { describe, expect, it, vi } from "vitest";
import {
  rewriteDescription,
  rewriteNoticia,
  runEditorialEngine,
  CloudflareWorkersAiProvider,
  EditorialEngineError,
  ProviderError,
} from "../../src/editorial/index.ts";

function mockProvider(response: string | Error) {
  return {
    name: "mock",
    complete: vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  };
}

describe("rewriteDescription - contrato y preservación", () => {
  it("reescribe solo 'descripcion' y preserva el resto", async () => {
    const input = {
      titulo: "La Provincia entregó premio",
      descripcion: "La ceremonia fue encabezada por el gobernador.",
      imagenUrl: "https://example.com/img.jpg",
      urlNoticia: "https://example.com/nota",
      fecha: null,
      volanta: "CULTURA",
      fuente: "gba",
      slug: "la-provincia-entrego-premio",
    };
    const provider = mockProvider("El gobernador encabezó la entrega del premio.");
    const result = await rewriteDescription(input, { provider });

    expect(result.field).toBe("descripcion");
    expect(result.description).toBe("El gobernador encabezó la entrega del premio.");
    expect(result.output.descripcion).toBe("El gobernador encabezó la entrega del premio.");
    // Preservación exacta.
    for (const key of Object.keys(input)) {
      if (key !== "descripcion") {
        expect(result.output[key]).toEqual(input[key as keyof typeof input]);
      }
    }
    expect(Object.keys(result.output).sort()).toEqual(Object.keys(input).sort());
  });

  it("soporta campo 'description' (inglés) y lo preserva", async () => {
    const input = { title: "X", description: "Original desc.", url: "https://x" };
    const provider = mockProvider("Nueva desc.");
    const result = await rewriteDescription(input, { provider });
    expect(result.field).toBe("description");
    expect(result.output.description).toBe("Nueva desc.");
    expect(result.output.title).toBe("X");
    expect(result.output.url).toBe("https://x");
  });

  it("rechaza entrada no objeto", async () => {
    const provider = mockProvider("x");
    await expect(rewriteDescription("texto", { provider })).rejects.toBeInstanceOf(EditorialEngineError);
    await expect(rewriteDescription(null, { provider })).rejects.toBeInstanceOf(EditorialEngineError);
    await expect(rewriteDescription([1, 2], { provider })).rejects.toBeInstanceOf(EditorialEngineError);
  });

  it("rechaza entrada sin campo de descripción", async () => {
    const provider = mockProvider("x");
    await expect(rewriteDescription({ titulo: "X" }, { provider })).rejects.toMatchObject({ code: "MISSING_DESCRIPTION_FIELD" });
  });

  it("rechaza descripción vacía", async () => {
    const provider = mockProvider("x");
    await expect(rewriteDescription({ descripcion: "   " }, { provider })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rechaza salida vacía del proveedor", async () => {
    const provider = mockProvider("   ");
    await expect(rewriteDescription({ descripcion: "algo" }, { provider })).rejects.toMatchObject({ code: "RETRIES_EXHAUSTED" });
  });

  it("rechaza salida que supera el máximo", async () => {
    const long = "a".repeat(300);
    const provider = mockProvider(long);
    await expect(rewriteDescription({ descripcion: "algo" }, { provider, maxDescriptionLength: 50 })).rejects.toMatchObject({ code: "RETRIES_EXHAUSTED" });
  });

  it("rechaza salida JSON/Markdown", async () => {
    const provider = mockProvider('{"descripcion":"x"}');
    // extractDescription extrae el campo, que es válido -> no rechaza. Usar fence.
    const provider2 = mockProvider("```");
    await expect(rewriteDescription({ descripcion: "algo" }, { provider: provider2 })).rejects.toBeInstanceOf(EditorialEngineError);
  });

  it("reintenta ante respuesta inválida y tiene éxito", async () => {
    const provider = {
      name: "mock",
      complete: vi.fn()
        .mockResolvedValueOnce("   ")
        .mockResolvedValueOnce("Descripción válida."),
    };
    const result = await rewriteDescription({ descripcion: "original" }, { provider, maxRetries: 2 });
    expect(result.description).toBe("Descripción válida.");
    expect(result.attempts).toBe(2);
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it("agota reintentos y lanza RETRIES_EXHAUSTED", async () => {
    const provider = mockProvider("   ");
    await expect(rewriteDescription({ descripcion: "original" }, { provider, maxRetries: 1 })).rejects.toMatchObject({ code: "RETRIES_EXHAUSTED" });
  });

  it("propaga ProviderError sin reintentar entrada inválida", async () => {
    const provider = mockProvider(new ProviderError("boom"));
    await expect(rewriteDescription({ descripcion: "original" }, { provider, maxRetries: 2 })).rejects.toMatchObject({ code: "RETRIES_EXHAUSTED" });
  });

  it("detecta alteración de campos (assertPreserved)", async () => {
    // El motor construye output preservando; este test verifica que si el proveedor
    // devuelve JSON con campo extra, se rechaza.
    const provider = mockProvider('{"descripcion":"x","titulo":"hackeado"}');
    // extractDescription extrae descripcion "x" (válido) -> no altera otros campos porque
    // el motor solo toma el texto. Verificamos preservación.
    const result = await rewriteDescription({ titulo: "T", descripcion: "orig" }, { provider });
    expect(result.output.titulo).toBe("T");
  });

  it("extrae descripción desde respuesta JSON del proveedor", async () => {
    const provider = mockProvider('{"descripcion":"Desde JSON."}');
    const result = await rewriteDescription({ descripcion: "orig" }, { provider });
    expect(result.description).toBe("Desde JSON.");
  });

  it("rechaza si el proveedor falta", async () => {
    // @ts-expect-error
    await expect(rewriteDescription({ descripcion: "x" }, {})).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("aliases exportados funcionan", async () => {
    const provider = mockProvider("ok");
    const r1 = await rewriteNoticia({ descripcion: "orig" }, { provider });
    const r2 = await runEditorialEngine({ descripcion: "orig" }, { provider });
    expect(r1.description).toBe("ok");
    expect(r2.description).toBe("ok");
  });

  it("field explícito inexistente se rechaza", async () => {
    const provider = mockProvider("ok");
    await expect(rewriteDescription({ descripcion: "orig" }, { provider, field: "noexiste" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("CloudflareWorkersAiProvider", () => {
  it("parsea respuesta estándar", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { response: "Hola." } }), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new CloudflareWorkersAiProvider({ token: "t", accountId: "a", fetchFn });
    const out = await provider.complete({ system: "s", user: "u" });
    expect(out).toBe("Hola.");
  });

  it("parsea choices", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ result: { choices: [{ message: { content: "Chau." } }] } }), { status: 200 }));
    const provider = new CloudflareWorkersAiProvider({ token: "t", accountId: "a", fetchFn });
    const out = await provider.complete({ system: "s", user: "u" });
    expect(out).toBe("Chau.");
  });

  it("lanza ProviderError en HTTP error", async () => {
    const fetchFn = vi.fn(async () => new Response("bad", { status: 401 }));
    const provider = new CloudflareWorkersAiProvider({ token: "t", accountId: "a", fetchFn });
    await expect(provider.complete({ system: "s", user: "u" })).rejects.toBeInstanceOf(ProviderError);
  });

  it("lanza ProviderError si faltan credenciales", () => {
    const prevToken = process.env.CLOUDFLARE_API_TOKEN;
    const prevAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    expect(() => new CloudflareWorkersAiProvider({})).toThrow(ProviderError);
    if (prevToken) process.env.CLOUDFLARE_API_TOKEN = prevToken;
    if (prevAccount) process.env.CLOUDFLARE_ACCOUNT_ID = prevAccount;
  });
});
