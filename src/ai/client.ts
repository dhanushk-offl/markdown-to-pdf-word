import {
  AiProviderId,
  AiModelInfo,
  KeyValidationResult,
  AiPolishConfig,
  PROVIDER_META,
  AiClientError,
} from "./types";
import { DEFAULT_SYSTEM_PROMPT } from "./prompts";
import { BaseProvider } from "./providers/BaseProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { ClaudeProvider } from "./providers/ClaudeProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenRouterProvider } from "./providers/OpenRouterProvider";

export function createProvider(
  provider: AiProviderId,
  apiKey: string,
  model: string,
  temperature = 0.3
): BaseProvider {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(apiKey, model, temperature);
    case "claude":
      return new ClaudeProvider(apiKey, model, temperature);
    case "gemini":
      return new GeminiProvider(apiKey, model, temperature);
    case "openrouter":
      return new OpenRouterProvider(apiKey, model, temperature);
  }
}

export async function validateKey(
  provider: AiProviderId,
  apiKey: string
): Promise<KeyValidationResult> {
  const p = createProvider(provider, apiKey, PROVIDER_META[provider].defaultModel);
  return p.validateKey();
}

export async function listModels(
  provider: AiProviderId,
  apiKey: string
): Promise<AiModelInfo[]> {
  const p = createProvider(provider, apiKey, PROVIDER_META[provider].defaultModel);
  return p.listModels();
}

export async function polishMarkdown(
  markdown: string,
  config: AiPolishConfig,
  getApiKey: (provider: AiProviderId) => Promise<string | undefined>,
  onStatus?: (status: string) => void
): Promise<string> {
  if (!config.enabled || !markdown.trim()) return markdown;

  const key = await getApiKey(config.provider);
  if (!key) {
    onStatus?.("No API key configured — skipping AI polish");
    return markdown;
  }

  const prompt = config.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const provider = createProvider(config.provider, key, config.model, config.temperature);

  onStatus?.("Polishing with AI…");
  try {
    const result = await provider.chat(prompt, markdown);
    if (!result || result.length < markdown.length * 0.2) {
      onStatus?.("AI returned unexpected output — using original");
      return markdown;
    }
    onStatus?.("AI polish complete");
    return result;
  } catch (err) {
    const msg = err instanceof AiClientError ? err.message : "Unknown error";
    onStatus?.("AI polish failed: " + msg);
    return markdown;
  }
}
