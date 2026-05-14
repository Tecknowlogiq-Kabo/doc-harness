# DocHarness

AI-powered documentation generation platform. Enter a single prompt and get a complete suite of professional software documents — PRDs, ADRs, implementation plans, and more — powered by 25 AI agents, 3-round adversarial debate, and a 6-phase pipeline.

## Quick Start

```bash
pnpm install
export ANTHROPIC_API_KEY=sk-ant-...
pnpm --filter @doc-harness/core build
pnpm dev
```

Open http://localhost:3000

## CLI Usage

```bash
pnpm --filter @doc-harness/core build
node packages/core/dist/cli/bin.js "Build a real-time chat app with WebSocket" --output ./my-docs
```

## Architecture

```
packages/
├── core/    @doc-harness/core — Pipeline engine, 25 agents, 5 tools
└── web/     @doc-harness/web  — Next.js 15 UI with real-time SSE streaming
```

### 6-Phase Pipeline

| Phase | Description |
|-------|-------------|
| 0. Intake | Classify prompt → select document types |
| 1. Discovery | Build domain knowledge |
| 2. Generation | Generate all documents in parallel (specialist agents) |
| 3. Debate | 3-round adversarial debate (Advocate vs Skeptic, judged by Mediator) |
| 4. Review | Quality scoring + escalation |
| 5. Assembly | Output assembly |

### 18 Document Types

| Track | Types |
|-------|-------|
| Vision | PRD, Idea, Plan, MRD, BRD, URD, BRS, STRS, SYRS, SRS |
| Knowledge | ADR, RFC, Rule, Guide, Spec, Doc |
| Experience | Task Type, CPAT |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required: Anthropic API key |
| `DOC_HARNESS_MODEL` | `claude-sonnet-4-5` | Model to use |
| `CLOUDFLARE_AI_GATEWAY_URL` | — | Optional Cloudflare AI Gateway |
| `CLOUDFLARE_AI_GATEWAY_TOKEN` | — | Optional Gateway token |
| `DOC_HARNESS_OUTPUT_DIR` | `./docs` | Default output directory |
| `DOC_HARNESS_BATCH_SIZE` | `4` | Debate batch size |
| `DOC_HARNESS_SCORE_THRESHOLD` | `0.7` | Quality gate threshold |

## Development

```bash
pnpm --filter @doc-harness/core test     # Run tests
pnpm --filter @doc-harness/core typecheck # Type check core
pnpm --filter @doc-harness/web typecheck  # Type check web
pnpm build                                # Build all packages
```
