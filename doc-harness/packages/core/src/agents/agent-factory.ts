import { generateText, stepCountIs, type Tool, type LanguageModel, type LanguageModelUsage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

function getModel(): LanguageModel {
  const modelName = process.env.OLLAMA_MODEL ?? "deepseek-v4-flash";
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "https://api.ollama.com/v1";
  const apiKey = process.env.OLLAMA_API_KEY ?? "ollama";

  const ollamaProvider = createOpenAI({ baseURL: baseUrl, apiKey });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ollamaProvider(modelName) as any;
}

export interface AgentConfig {
  system: string;
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
    model = getModel(),
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
