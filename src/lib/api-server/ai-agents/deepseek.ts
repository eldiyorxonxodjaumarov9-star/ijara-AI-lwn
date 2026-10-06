export type DeepSeekConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

export type DeepSeekStatus =
  | { configured: true; model: string }
  | { configured: false; missing: ("DEEPSEEK_API_KEY" | "DEEPSEEK_MODEL")[] };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type DeepSeekUsage = { inputTokens: number; outputTokens: number };

export type DeepSeekResult = {
  content: string;
  model: string;
  responseId: string | null;
  /** Null when the provider response carried no usage object — never synthesized. */
  usage: DeepSeekUsage | null;
  attempts: number;
};

export type DeepSeekErrorCode =
  | "DEEPSEEK_NOT_CONFIGURED"
  | "DEEPSEEK_UNAVAILABLE"
  | "DEEPSEEK_AUTH_FAILED"
  | "DEEPSEEK_BAD_RESPONSE";

export class DeepSeekError extends Error {
  constructor(
    readonly code: DeepSeekErrorCode,
    message: string,
    readonly httpStatus: number | null = null
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export const DEEPSEEK_MAX_RETRIES = 2;
const DEFAULT_BASE_URL = "https://api.deepseek.com";
const TIMEOUT_MS = 45_000;

export function readDeepSeekConfig(env: NodeJS.ProcessEnv = process.env): DeepSeekConfig | null {
  const apiKey = env.DEEPSEEK_API_KEY?.trim() ?? "";
  const model = env.DEEPSEEK_MODEL?.trim() ?? "";
  if (!apiKey || !model) return null;
  const baseUrl = (env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { apiKey, model, baseUrl };
}

export function deepSeekStatus(env: NodeJS.ProcessEnv = process.env): DeepSeekStatus {
  const config = readDeepSeekConfig(env);
  if (config) return { configured: true, model: config.model };
  const missing: ("DEEPSEEK_API_KEY" | "DEEPSEEK_MODEL")[] = [];
  if (!env.DEEPSEEK_API_KEY?.trim()) missing.push("DEEPSEEK_API_KEY");
  if (!env.DEEPSEEK_MODEL?.trim()) missing.push("DEEPSEEK_MODEL");
  return { configured: false, missing };
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function readUsage(raw: unknown): DeepSeekUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const input = u.prompt_tokens;
  const output = u.completion_tokens;
  if (typeof input !== "number" || typeof output !== "number") return null;
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return { inputTokens: Math.max(0, Math.trunc(input)), outputTokens: Math.max(0, Math.trunc(output)) };
}

/**
 * One chat completion (OpenAI-compatible DeepSeek API). Retries transient
 * failures at most DEEPSEEK_MAX_RETRIES times. Error messages never contain the key.
 */
export async function deepSeekChat(
  input: { messages: ChatMessage[]; temperature?: number; jsonMode?: boolean; maxTokens?: number },
  deps: {
    config?: DeepSeekConfig | null;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<DeepSeekResult> {
  const config = deps.config === undefined ? readDeepSeekConfig() : deps.config;
  if (!config) throw new DeepSeekError("DEEPSEEK_NOT_CONFIGURED", "DeepSeek ulanmagan");
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const body = JSON.stringify({
    model: config.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 1500,
    stream: false,
    ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  let lastError: DeepSeekError | null = null;
  for (let attempt = 1; attempt <= DEEPSEEK_MAX_RETRIES + 1; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      lastError = new DeepSeekError("DEEPSEEK_UNAVAILABLE", "DeepSeek vaqtincha mavjud emas");
      if (attempt <= DEEPSEEK_MAX_RETRIES) await sleep(500 * attempt);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new DeepSeekError("DEEPSEEK_AUTH_FAILED", "DeepSeek API kaliti rad etildi", res.status);
    }
    if (!res.ok) {
      lastError = new DeepSeekError("DEEPSEEK_UNAVAILABLE", "DeepSeek vaqtincha mavjud emas", res.status);
      if (isRetryableStatus(res.status) && attempt <= DEEPSEEK_MAX_RETRIES) {
        await sleep(500 * attempt);
        continue;
      }
      throw lastError;
    }

    const data = (await res.json().catch(() => null)) as {
      id?: unknown;
      model?: unknown;
      choices?: { message?: { content?: unknown } }[];
      usage?: unknown;
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new DeepSeekError("DEEPSEEK_BAD_RESPONSE", "DeepSeek bo‘sh javob qaytardi", res.status);
    }
    return {
      content,
      model: typeof data?.model === "string" && data.model ? data.model : config.model,
      responseId: typeof data?.id === "string" ? data.id : null,
      usage: readUsage(data?.usage),
      attempts: attempt,
    };
  }
  throw lastError ?? new DeepSeekError("DEEPSEEK_UNAVAILABLE", "DeepSeek vaqtincha mavjud emas");
}
