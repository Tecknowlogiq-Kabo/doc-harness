import { generateText, stepCountIs, type Tool, type LanguageModel, type LanguageModelUsage } from "ai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";

function getModel(): LanguageModel {
  const gatewayUrl = process.env.CLOUDFLARE_AI_GATEWAY_URL;
  const gatewayToken = process.env.CLOUDFLARE_AI_GATEWAY_TOKEN;
  const modelName = process.env.DOC_HARNESS_MODEL ?? "claude-sonnet-4-5";

  if (gatewayUrl && gatewayToken) {
    const gatewayProvider = createAnthropic({
      baseURL: gatewayUrl,
      apiKey: gatewayToken,
    });
    return gatewayProvider(modelName);
  }

  return anthropic(modelName);
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
