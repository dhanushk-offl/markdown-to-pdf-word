import { BaseProvider } from "./BaseProvider";
import { AiModelInfo, AiProviderId, KeyValidationResult, PROVIDER_META } from "../types";

export class OpenAIProvider extends BaseProvider {
  protected get providerId(): AiProviderId {
    return "openai";
  }

  async chat(systemPrompt: string, userContent: string): Promise<string> {
    const meta = PROVIDER_META.openai;
    const data = await this.fetchJson(meta.endpoints.chat, {
      method: "POST",
      headers: {
        Authorization: meta.apiKeyPrefix + this.apiKey,
        "Content-Type": "application/json",
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
    const meta = PROVIDER_META.openai;
    const data = await this.fetchJson(meta.endpoints.models, {
      headers: { Authorization: meta.apiKeyPrefix + this.apiKey },
    });
    const chatModels = (data.data || []).filter(
      (m: any) =>
        m.id.startsWith("gpt-") &&
        !m.id.includes("instruct") &&
        !m.id.includes("realtime") &&
        (m.id.includes("mini") ||
          m.id.includes("turbo") ||
          m.id === "gpt-4o" ||
          m.id.startsWith("gpt-4-"))
    );
    return chatModels.map((m: any) => ({
      id: m.id,
      label: m.id,
      contextWindow: 128000,
      provider: "openai" as AiProviderId,
    }));
  }

  async validateKey(): Promise<KeyValidationResult> {
    const models = await this.listModels();
    return {
      valid: true,
      message: `OpenAI key valid — ${models.length} models available`,
      models,
    };
  }
}
