import { BaseProvider } from "./BaseProvider";
import { AiModelInfo, AiProviderId, KeyValidationResult, PROVIDER_META } from "../types";

const FALLBACK_MODELS: AiModelInfo[] = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", contextWindow: 128000, provider: "openrouter" },
  { id: "openai/gpt-4o", label: "GPT-4o", contextWindow: 128000, provider: "openrouter" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", contextWindow: 200000, provider: "openrouter" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", contextWindow: 200000, provider: "openrouter" },
  { id: "google/gemini-1.5-flash", label: "Gemini 1.5 Flash", contextWindow: 128000, provider: "openrouter" },
  { id: "google/gemini-1.5-pro", label: "Gemini 1.5 Pro", contextWindow: 128000, provider: "openrouter" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", contextWindow: 128000, provider: "openrouter" },
  { id: "mistralai/mistral-large", label: "Mistral Large", contextWindow: 128000, provider: "openrouter" },
];

export class OpenRouterProvider extends BaseProvider {
  protected get providerId(): AiProviderId {
    return "openrouter";
  }

  async chat(systemPrompt: string, userContent: string): Promise<string> {
    const meta = PROVIDER_META.openrouter;
    const data = await this.fetchJson(meta.endpoints.chat, {
      method: "POST",
      headers: {
        Authorization: meta.apiKeyPrefix + this.apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/anandsundaramoorthysa/markdown-to-pdf-word",
        "X-Title": "Markdown to PDF & Word",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: this.temperature,
      }),
    });
    return data.choices?.[0]?.message?.content || "";
  }

  async listModels(): Promise<AiModelInfo[]> {
    try {
      const data = await this.fetchJson(PROVIDER_META.openrouter.endpoints.models, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const items = data.data || data;
      if (Array.isArray(items)) {
        return items.map((m: any) => ({
          id: m.id,
          label: m.name || m.id,
          contextWindow: m.context_length || 128000,
          provider: "openrouter" as AiProviderId,
        }));
      }
    } catch {
      /* fall through */
    }
    return FALLBACK_MODELS;
  }

  async validateKey(): Promise<KeyValidationResult> {
    const data = await this.fetchJson(PROVIDER_META.openrouter.endpoints.validate, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    const creditMsg = data.credits != null ? ` — credit: ${data.credits}` : "";
    let models: AiModelInfo[] = [];
    try {
      models = await this.listModels();
    } catch {
      /* non-critical */
    }
    return {
      valid: true,
      message: `OpenRouter key valid${creditMsg}`,
      models: models.length ? models : FALLBACK_MODELS,
    };
  }
}
