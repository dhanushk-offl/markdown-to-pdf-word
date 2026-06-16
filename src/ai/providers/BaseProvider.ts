import { AiClientError, AiModelInfo, AiProviderId, KeyValidationResult } from "../types";

export abstract class BaseProvider {
  constructor(
    protected readonly apiKey: string,
    protected readonly model: string,
    protected readonly temperature: number
  ) {}

  abstract chat(systemPrompt: string, userContent: string): Promise<string>;
  abstract listModels(): Promise<AiModelInfo[]>;
  abstract validateKey(): Promise<KeyValidationResult>;

  protected abstract get providerId(): AiProviderId;

  protected async fetchJson(
    url: string,
    init: RequestInit & { headers: Record<string, string> },
    timeoutMs = 30_000
  ): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 401) throw new AiClientError("Invalid API key", "invalid_key", this.providerId);
        if (res.status === 429) throw new AiClientError("Rate limited", "rate_limited", this.providerId);
        if (res.status === 404) throw new AiClientError(`Model or endpoint not found: ${body.slice(0, 200)}`, "bad_response", this.providerId);
        throw new AiClientError(`HTTP ${res.status}: ${body.slice(0, 200)}`, "bad_response", this.providerId);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof AiClientError) throw err;
      if ((err as any)?.name === "AbortError") throw new AiClientError("Request timed out", "timeout", this.providerId);
      throw new AiClientError((err as any)?.message || "Network error", "network", this.providerId);
    }
  }
}
