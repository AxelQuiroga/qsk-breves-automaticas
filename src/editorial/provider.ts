import { ProviderError } from "./errors.ts";

/**
 * Contrato mínimo de un proveedor LLM. La lógica editorial NO debe conocer
 * detalles del transporte (URLs, headers, SDKs): solo pide una completion.
 */
export interface LlmCompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmCompletionRequest): Promise<string>;
}

export interface CloudflareWorkersAiOptions {
  /** Token de Cloudflare (o env CLOUDFLARE_API_TOKEN). */
  token?: string;
  /** Account ID de Cloudflare (o env CLOUDFLARE_ACCOUNT_ID). */
  accountId?: string;
  /** Modelo a usar. Default: @cf/zai-org/glm-4.7-flash */
  model?: string;
  /** fetch inyectable para tests. */
  fetchFn?: typeof fetch;
  /** Base URL (para tests/mocks). */
  baseUrl?: string;
  /** Timeout en ms para la petición. Default 30000. */
  timeoutMs?: number;
}

const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";
const DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4";

/**
 * Proveedor concreto para Cloudflare Workers AI.
 *
 * Desacoplado de la lógica editorial: implementa `LlmProvider` y encapsula
 * todo el detalle HTTP. No lanza errores no tipados: todo se convierte en
 * `ProviderError`.
 */
export class CloudflareWorkersAiProvider implements LlmProvider {
  public readonly name = "cloudflare-workers-ai";
  private readonly token: string;
  private readonly accountId: string;
  private readonly model: string;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: CloudflareWorkersAiOptions = {}) {
    const token = options.token ?? process.env.CLOUDFLARE_API_TOKEN ?? "";
    const accountId = options.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    if (!token) throw new ProviderError("Falta CLOUDFLARE_API_TOKEN.", undefined, false);
    if (!accountId) throw new ProviderError("Falta CLOUDFLARE_ACCOUNT_ID.", undefined, false);
    this.token = token;
    this.accountId = accountId;
    this.model = options.model ?? process.env.CLOUDFLARE_MODEL ?? DEFAULT_MODEL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async complete(request: LlmCompletionRequest): Promise<string> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/ai/run/${this.model}`;
    const body = JSON.stringify({
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      max_tokens: request.maxTokens ?? 512,
      temperature: request.temperature ?? 0.2,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      const isAbort = error instanceof Error && error.name === "AbortError";
      throw new ProviderError(
        isAbort ? "Timeout contactando a Cloudflare Workers AI." : "No se pudo contactar a Cloudflare Workers AI.",
        error,
        true,
      );
    }
    clearTimeout(timer);

    let payload: unknown;
    try {
      const text = await response.text();
      payload = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new ProviderError("Respuesta no JSON de Cloudflare Workers AI.", error, response.status >= 500);
    }

    if (!response.ok) {
      const detail = typeof payload === "object" && payload !== null
        ? JSON.stringify(payload).slice(0, 1000)
        : String(payload);
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new ProviderError(`Workers AI respondió HTTP ${response.status}: ${detail}`, undefined, retryable);
    }

    if (typeof payload === "object" && payload !== null && (payload as { success?: boolean }).success === false) {
      throw new ProviderError(
        "Workers AI informó un error: " + JSON.stringify((payload as { errors?: unknown }).errors ?? []),
        undefined,
        false,
      );
    }

    const text = extractResponseText(payload);
    if (!text) {
      throw new ProviderError("Workers AI devolvió una respuesta sin texto reconocible.", undefined, true);
    }
    return text;
  }
}

function extractResponseText(payload: unknown): string | null {
  const result = (typeof payload === "object" && payload !== null && "result" in payload)
    ? (payload as { result: unknown }).result
    : payload;

  if (typeof result === "string") return result;
  if (typeof result !== "object" || result === null) return null;

  const r = result as Record<string, unknown>;
  if (typeof r.response === "string") return r.response;
  if (typeof r.output_text === "string") return r.output_text;

  const choices = r.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const message = first?.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === "string") return message.content;
    if (typeof first?.text === "string") return first.text;
  }
  return null;
}
