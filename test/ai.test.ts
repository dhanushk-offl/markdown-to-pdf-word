import { describe, it, expect, vi, afterEach } from "vitest";
import {
  PROVIDER_META,
  AiClientError,
  AiProviderId,
  AiPolishConfig,
} from "../src/ai/types";
import { DEFAULT_SYSTEM_PROMPT } from "../src/ai/prompts";
import { validateKey } from "../src/ai/client";

describe("AI types", () => {
  it("all providers have metadata", () => {
    const ids: AiProviderId[] = ["openai", "claude", "gemini", "openrouter"];
    for (const id of ids) {
      const meta = PROVIDER_META[id];
      expect(meta.id).toBe(id);
      expect(meta.label).toBeTruthy();
      expect(meta.defaultModel).toBeTruthy();
      expect(meta.endpoints.chat).toBeTruthy();
      expect(meta.endpoints.models).toBeTruthy();
      expect(meta.endpoints.validate).toBeTruthy();
    }
  });

  it("provider meta endpoints are distinct", () => {
    expect(PROVIDER_META.openai.endpoints.chat).toContain("openai.com");
    expect(PROVIDER_META.claude.endpoints.chat).toContain("anthropic.com");
    expect(PROVIDER_META.gemini.endpoints.chat).toContain("googleapis.com");
    expect(PROVIDER_META.openrouter.endpoints.chat).toContain("openrouter.ai");
  });

  it("each provider has an auth header strategy", () => {
    for (const meta of Object.values(PROVIDER_META)) {
      expect(meta.apiKeyHeader).toBeTruthy();
      expect(typeof meta.apiKeyPrefix).toBe("string");
    }
  });
});

describe("AiClientError", () => {
  it("carries code and provider", () => {
    const err = new AiClientError("Invalid key", "invalid_key", "openai");
    expect(err.message).toBe("Invalid key");
    expect(err.code).toBe("invalid_key");
    expect(err.provider).toBe("openai");
    expect(err.name).toBe("AiClientError");
  });

  it("all error codes are creatable", () => {
    const codes: AiClientError["code"][] = [
      "invalid_key",
      "rate_limited",
      "timeout",
      "bad_response",
      "network",
    ];
    for (const code of codes) {
      const err = new AiClientError("test", code, "claude");
      expect(err.code).toBe(code);
    }
  });
});

describe("AiPolishConfig", () => {
  it("default config is valid", () => {
    const config: AiPolishConfig = {
      enabled: false,
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: "",
      temperature: 0.3,
    };
    expect(config.enabled).toBe(false);
    expect(config.temperature).toBeGreaterThanOrEqual(0);
    expect(config.temperature).toBeLessThanOrEqual(1);
  });

  it("accepts all providers", () => {
    const providers: AiProviderId[] = ["openai", "claude", "gemini", "openrouter"];
    for (const provider of providers) {
      const config: AiPolishConfig = {
        enabled: true,
        provider,
        model: "test-model",
        systemPrompt: "",
        temperature: 0.5,
      };
      expect(config.provider).toBe(provider);
    }
  });
});

describe("DEFAULT_SYSTEM_PROMPT", () => {
  it("is non-empty", () => {
    expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("contains key instructions", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Preserve ALL heading levels");
    expect(DEFAULT_SYSTEM_PROMPT).toContain("code blocks");
    expect(DEFAULT_SYSTEM_PROMPT).toContain("NEVER add information");
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Output");
  });
});

describe("profile normalization", () => {
  it("aiPolish defaults are set in normalizeProfile", async () => {
    const { normalizeProfile } = await import("../src/profiles");
    const profile = normalizeProfile({});
    const ai = profile.options.aiPolish;
    expect(ai).toBeTruthy();
    expect(ai!.enabled).toBe(false);
    expect(ai!.provider).toBe("openai");
    expect(ai!.model).toBe("gpt-4o-mini");
    expect(ai!.systemPrompt).toBe("");
    expect(ai!.temperature).toBe(0.3);
  });

  it("aiPolish partial merge preserves unset fields", async () => {
    const { normalizeProfile } = await import("../src/profiles");
    const profile = normalizeProfile({
      options: { aiPolish: { enabled: true } },
    });
    expect(profile.options.aiPolish!.enabled).toBe(true);
    expect(profile.options.aiPolish!.provider).toBe("openai");
    expect(profile.options.aiPolish!.model).toBe("gpt-4o-mini");
  });
});

describe("polishMarkdown graceful degradation", () => {
  it("returns original when disabled", async () => {
    const { polishMarkdown } = await import("../src/ai/client");
    const result = await polishMarkdown("# Hello", {
      enabled: false,
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: "",
      temperature: 0.3,
    }, async () => "sk-test");
    expect(result).toBe("# Hello");
  });

  it("returns original when no key", async () => {
    const { polishMarkdown } = await import("../src/ai/client");
    const result = await polishMarkdown("# Hello", {
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: "",
      temperature: 0.3,
    }, async () => undefined);
    expect(result).toBe("# Hello");
  });

  it("returns original on empty input", async () => {
    const { polishMarkdown } = await import("../src/ai/client");
    const result = await polishMarkdown("", {
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: "",
      temperature: 0.3,
    }, async () => "sk-test");
    expect(result).toBe("");
  });
});

describe("validateKey rejects invalid keys (mocked HTTP)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Claude: 401 must NOT report the key as valid (regression: fallback models hid the error)", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
    const r = await validateKey("claude", "bad-key");
    expect(r.valid).toBe(false);
  });

  it("Gemini: 400 'API key not valid' is treated as an invalid key", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ error: { code: 400, message: "API key not valid. Please pass a valid API key." } }), { status: 400 }));
    const r = await validateKey("gemini", "bad-key");
    expect(r.valid).toBe(false);
  });

  it("OpenAI: 401 is surfaced as an invalid_key error", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 401 }));
    await expect(validateKey("openai", "bad-key")).rejects.toMatchObject({ code: "invalid_key" });
  });

  it("Claude: a valid models response reports the key as valid", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ data: [{ id: "claude-3-5-haiku-latest", display_name: "Haiku" }] }), { status: 200 }));
    const r = await validateKey("claude", "good-key");
    expect(r.valid).toBe(true);
    expect(r.models && r.models.length).toBeGreaterThan(0);
  });
});
