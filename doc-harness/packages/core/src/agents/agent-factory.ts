import { generateText, stepCountIs, type Tool, type LanguageModel, type LanguageModelUsage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const ollama = createOpenAI({
  baseURL: process.env.OLLAMA_BASE_URL ?? "https://ollama.com/v1",
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
});

const ROLE_MODELS: Record<string, string> = {
  orchestrator: process.env.OLLAMA_ORCHESTRATOR_MODEL ?? "deepseek-v4-flash",
  specialist:  process.env.OLLAMA_SPECIALIST_MODEL  ?? "deepseek-v4-pro",
  debate:      process.env.OLLAMA_DEBATE_MODEL      ?? "kimi-k2.6",
};

export function getModelForRole(role: string): LanguageModel {
  const modelName = ROLE_MODELS[role] ?? ROLE_MODELS.orchestrator;
  return ollama(modelName) as any;
}

let totalTokens = { prompt: 0, completion: 0 };

export function getTokenUsage() {
  return { ...totalTokens };
}

export function resetTokenUsage() {
  totalTokens = { prompt: 0, completion: 0 };
}

export interface AgentConfig {
  system: string;
  role?: "orchestrator" | "specialist" | "debate";
  tools?: Record<string, Tool>;
  maxSteps?: number;
  model?: LanguageModel;
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
}

export interface AgentGenerateResult {
  text: string;
  usage?: LanguageModelUsage;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAgent(config: AgentConfig) {
  const {
    role = "specialist",
    model = getModelForRole(role),
    system,
    tools = {},
    maxSteps = 5,
    retry = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000 },
  } = config;

  return {
    generate: async (prompt: string, signal?: AbortSignal): Promise<AgentGenerateResult> => {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= retry.maxAttempts!; attempt++) {
        if (signal?.aborted) {
          throw new Error("Operation cancelled");
        }
        try {
          const result = await generateText({
            model,
            system,
            prompt,
            tools,
            stopWhen: stepCountIs(maxSteps),
            abortSignal: signal,
          });

          if (result.usage) {
            totalTokens.prompt += result.usage.inputTokens ?? 0;
            totalTokens.completion += result.usage.outputTokens ?? 0;
          }

          return {
            text: result.text,
            usage: result.usage,
          };
        } catch (err) {
          if (signal?.aborted) throw new Error("Operation cancelled");
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < retry.maxAttempts!) {
            const delay = Math.min(
              retry.baseDelayMs! * Math.pow(2, attempt - 1),
              retry.maxDelayMs!
            );
            await sleep(delay);
          }
        }
      }

      throw lastError ?? new Error("Agent generation failed after all retries");
    },
  };
}

export type Agent = ReturnType<typeof createAgent>;
