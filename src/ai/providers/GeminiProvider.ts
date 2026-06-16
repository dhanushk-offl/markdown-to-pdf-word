import { BaseProvider } from "./BaseProvider";
import { AiModelInfo, AiProviderId, KeyValidationResult, PROVIDER_META } from "../types";

export class GeminiProvider extends BaseProvider {
  protected get providerId(): AiProviderId {
    return "gemini";
  }

  private chatUrl(): string {
    return PROVIDER_META.gemini.endpoints.chat.replace(
      "{model}",
      this.model
    );
  }

  async chat(systemPrompt: string, userContent: string): Promise<string> {
    const url = this.chatUrl() + `?key=${this.apiKey}`;
    const data = await this.fetchJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userContent }] }],
        generationConfig: { temperature: this.temperature },
      }),
    });
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async listModels(): Promise<AiModelInfo[]> {
    const url = PROVIDER_META.gemini.endpoints.models + `?key=${this.apiKey}`;
    const data = await this.fetchJson(url, { headers: {} });
    return (data.models || [])
      .filter(
        (m: any) =>
          m.name?.includes("gemini") &&
          m.supportedGenerationMethods?.includes("generateContent")
      )
      .map((m: any) => ({
        id: m.name.split("/").pop(),
        label: m.displayName || m.name.split("/").pop(),
        contextWindow: m.inputTokenLimit || 128000,
        provider: "gemini" as AiProviderId,
      }));
  }

  async validateKey(): Promise<KeyValidationResult> {
    const models = await this.listModels();
    return {
      valid: true,
      message: `Gemini key valid — ${models.length} models`,
      models,
    };
  }
}
