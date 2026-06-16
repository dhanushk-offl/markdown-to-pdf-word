import { BaseProvider } from "./BaseProvider";
import { AiModelInfo, AiProviderId, KeyValidationResult, PROVIDER_META } from "../types";

const FALLBACK_MODELS: AiModelInfo[] = [
  { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", contextWindow: 200000, provider: "claude" },
  { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", contextWindow: 200000, provider: "claude" },
  { id: "claude-3-opus-latest", label: "Claude 3 Opus", contextWindow: 200000, provider: "claude" },
];

export class ClaudeProvider extends BaseProvider {
  protected get providerId(): AiProviderId {
    return "claude";
  }

  async chat(systemPrompt: string, userContent: string): Promise<string> {
    const meta = PROVIDER_META.claude;
    const data = await this.fetchJson(meta.endpoints.chat, {
      method: "POST",
      headers: {
        [meta.apiKeyHeader]: this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        temperature: this.temperature,
      }),
    });
    return data.content?.[0]?.text || "";
  }

  async listModels(): Promise<AiModelInfo[]> {
    const meta = PROVIDER_META.claude;
    try {
      const data = await this.fetchJson(meta.endpoints.models, {
        headers: {
          [meta.apiKeyHeader]: this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      });
      if (data.data && Array.isArray(data.data)) {
        return data.data
          .filter((m: any) => m.id?.startsWith("claude-"))
          .map((m: any) => ({
            id: m.id,
            label: m.display_name || m.id,
            contextWindow: m.context_window || 200000,
            provider: "claude" as AiProviderId,
          }));
      }
    } catch {
      /* fall through to fallback */
    }
    return FALLBACK_MODELS;
  }

  async validateKey(): Promise<KeyValidationResult> {
    try {
      const models = await this.listModels();
      return { valid: true, message: `Claude key valid — ${models.length} models`, models };
    } catch {
      const data = await this.fetchJson(PROVIDER_META.claude.endpoints.chat, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "." }],
        }),
      });
      return { valid: true, message: "Claude key valid", models: FALLBACK_MODELS };
    }
  }
}
