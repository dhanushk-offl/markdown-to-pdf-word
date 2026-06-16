export type AiProviderId = "openai" | "claude" | "gemini" | "openrouter";

export interface AiModelInfo {
  id: string;
  label: string;
  contextWindow: number;
  provider: AiProviderId;
}

export interface KeyValidationResult {
  valid: boolean;
  message: string;
  models?: AiModelInfo[];
}

export interface AiPolishConfig {
  enabled: boolean;
  provider: AiProviderId;
  model: string;
  systemPrompt: string;
  temperature: number;
}

export interface ProviderMeta {
  id: AiProviderId;
  label: string;
  defaultModel: string;
  endpoints: {
    chat: string;
    models: string;
    validate: string;
  };
  apiKeyHeader: string;
  apiKeyPrefix: string;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid_key" | "rate_limited" | "timeout" | "bad_response" | "network",
    public readonly provider: AiProviderId
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

export const PROVIDER_META: Record<AiProviderId, ProviderMeta> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    endpoints: {
      chat: "https://api.openai.com/v1/chat/completions",
      models: "https://api.openai.com/v1/models",
      validate: "https://api.openai.com/v1/models",
    },
    apiKeyHeader: "Authorization",
    apiKeyPrefix: "Bearer ",
  },
  claude: {
    id: "claude",
    label: "Claude (Anthropic)",
    defaultModel: "claude-3-5-haiku-latest",
    endpoints: {
      chat: "https://api.anthropic.com/v1/messages",
      models: "https://api.anthropic.com/v1/models",
      validate: "https://api.anthropic.com/v1/models",
    },
    apiKeyHeader: "x-api-key",
    apiKeyPrefix: "",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-1.5-flash",
    endpoints: {
      chat: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
      models: "https://generativelanguage.googleapis.com/v1beta/models",
      validate: "https://generativelanguage.googleapis.com/v1beta/models",
    },
    apiKeyHeader: "x-goog-api-key",
    apiKeyPrefix: "",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    endpoints: {
      chat: "https://openrouter.ai/api/v1/chat/completions",
      models: "https://openrouter.ai/api/v1/models",
      validate: "https://openrouter.ai/api/v1/auth/key",
    },
    apiKeyHeader: "Authorization",
    apiKeyPrefix: "Bearer ",
  },
};
