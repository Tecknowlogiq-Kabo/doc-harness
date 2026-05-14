#!/usr/bin/env node
import { runCLI } from "./cli-runner.js";

const args = process.argv.slice(2);
let prompt = "";
let output: string | undefined;
let model: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output" || args[i] === "-o") {
    output = args[++i];
  } else if (args[i] === "--model" || args[i] === "-m") {
    model = args[++i];
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`DocHarness CLI
Usage: npx @doc-harness/core [prompt] [options]

Options:
  --output, -o   Output directory (default: ./docs)
  --model, -m    Model to use (default: claude-sonnet-4-5)
  --help, -h     Show this help
`);
    process.exit(0);
  } else {
    prompt += args[i] + " ";
  }
}

prompt = prompt.trim();

if (!prompt) {
  console.error("Error: Prompt is required\nUsage: npx @doc-harness/core \"Build a chat app\" --output ./my-docs");
  process.exit(1);
}

runCLI(prompt, { output, model });
