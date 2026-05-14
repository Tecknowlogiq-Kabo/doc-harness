export interface DocHarnessConfig {
  model: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  outputDir: string;
  debateBatchSize: number;
  scoreThreshold: number;
  maxRetries: number;
}

export function loadConfig(): DocHarnessConfig {
  return {
    model: process.env.DOC_HARNESS_MODEL ?? "claude-sonnet-4-5",
    gatewayUrl: process.env.CLOUDFLARE_AI_GATEWAY_URL,
    gatewayToken: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN,
    outputDir: process.env.DOC_HARNESS_OUTPUT_DIR ?? "./docs",
    debateBatchSize: parseInt(process.env.DOC_HARNESS_BATCH_SIZE ?? "4", 10),
    scoreThreshold: parseFloat(process.env.DOC_HARNESS_SCORE_THRESHOLD ?? "0.7"),
    maxRetries: parseInt(process.env.DOC_HARNESS_MAX_RETRIES ?? "3", 10),
  };
}
