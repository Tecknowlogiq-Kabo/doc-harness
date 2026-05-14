import { generateText, stepCountIs, type Tool, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export interface AgentConfig {
  system: string;
  tools?: Record<string, Tool>;
  maxSteps?: number;
  model?: LanguageModel;
}

export interface AgentGenerateResult {
  text: string;
}

export function createAgent(config: AgentConfig) {
  const {
    model = anthropic("claude-sonnet-4-5"),
    system,
    tools = {},
    maxSteps = 5,
  } = config;

  return {
    generate: async (prompt: string): Promise<AgentGenerateResult> => {
      const result = await generateText({
        model,
        system,
        prompt,
        tools,
        stopWhen: stepCountIs(maxSteps),
      });
      return { text: result.text };
    },
  };
}

export type Agent = ReturnType<typeof createAgent>;
