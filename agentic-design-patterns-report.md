# Agentic Design Patterns & Standards — Comprehensive Research Report

**Compiled:** May 2026 | **Focus:** Document generation pipelines with specialist agents + debate orchestrators

---

## 1. Anthropic's Agent Design Patterns

**Source:** [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) (Dec 2024)

### Core Distinction: Workflows vs. Agents

| | **Workflows** | **Agents** |
|---|---|---|
| **Definition** | LLMs orchestrated through predefined code paths | LLMs dynamically direct their own processes and tool usage |
| **Control** | Deterministic, predictable | Model-driven, flexible |
| **Best for** | Well-defined tasks with known steps | Open-ended problems where steps can't be predicted |
| **Cost/Latency** | Lower, bounded | Higher, variable |

### Golden Principle: Simplicity First

> "Start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short."

- Many tasks need only a single LLM call with retrieval + in-context examples
- Frameworks add abstraction layers that obscure prompts and responses — harder to debug
- Start with direct API calls; use frameworks only when complexity is demonstrably justified

### Pattern 1: Prompt Chaining (Sequential)

```
Step 1 → Gate → Step 2 → Gate → Step 3 → Output
```

- **What:** Decompose a task into fixed sequential steps, each feeding the next
- **When:** Task can be cleanly decomposed into fixed subtasks; main goal is higher accuracy at cost of latency
- **Document pipeline relevance:** Generate outline → review outline → generate document → review document → finalize
- **Trade-offs:** Higher latency, higher token cost, but higher accuracy per step

### Pattern 2: Routing

```
Input → Classifier → [Path A | Path B | Path C] → Output
```

- **What:** Classify input, direct to specialized handler
- **When:** Distinct categories benefit from specialized prompts/tools
- **Document pipeline relevance:** Route incoming requests to PRD specialist vs. ADR specialist vs. SRS specialist
- **Trade-offs:** Separation of concerns, but requires accurate classification

### Pattern 3: Parallelization (Sectioning + Voting)

- **Sectioning:** Break task into independent subtasks, run in parallel, aggregate
- **Voting:** Run same task multiple times for diverse outputs, then select/merge
- **When:** Subtasks are independent OR multiple perspectives improve confidence
- **Document pipeline relevance:** Run security review + performance review + style review in parallel on a document; multi-specialist debate output aggregation
- **Trade-offs:** Higher throughput, but harder to ensure consistency across outputs

### Pattern 4: Orchestrator-Workers

```
Input → Orchestrator → [Worker A, Worker B, Worker C] → Aggregation → Output
```

- **What:** Central LLM dynamically breaks down tasks, delegates to workers, synthesizes results
- **When:** Subtasks can't be predicted in advance (e.g., variable number of files to edit)
- **Key difference from parallelization:** Subtasks are NOT predefined — orchestrator determines them dynamically
- **Document pipeline relevance:** Orchestrator determines which specialist agents are needed for a given document request
- **Trade-offs:** Maximum flexibility, but highest complexity and cost

### Pattern 5: Evaluator-Optimizer (Feedback Loop)

```
Generator → Evaluator → [Pass: Output | Fail: Feedback → Generator → ...]
```

- **What:** One LLM generates, another evaluates, iterate until quality threshold met
- **When:** Clear evaluation criteria exist, iterative refinement provides measurable value
- **Two signs of good fit:**
  1. LLM responses demonstrably improve with human feedback
  2. LLM can provide that feedback itself
- **Document pipeline relevance:** Document specialist generates → Reviewer agent critiques → specialist revises → repeat
- **Trade-offs:** Higher quality, but unbounded iterations (needs max loop guard)

### Pattern 6: Autonomous Agent

```
User input → Agent (plan → tool call → observe → plan → tool call → ...) → Output
```

- **What:** LLM in a loop with tools, self-directing based on environmental feedback
- **When:** Open-ended problems, unpredictable steps, need trust in LLM decision-making
- **Key design concerns:**
  - Tool documentation quality is MORE important than prompt quality
  - Poka-yoke tools (make correct usage the only path)
  - Ground truth from environment at each step
  - Stopping conditions (max iterations, completion criteria)
  - Human feedback at checkpoints
- **Trade-offs:** Highest autonomy, but compounding errors and cost risk

### Three Core Principles (Anthropic)

1. **Simplicity** in agent design
2. **Transparency** — explicitly show the agent's planning steps
3. **Carefully craft ACI** (Agent-Computer Interface) through tool documentation and testing

### Tool Design Best Practices (ACI)

- Give model enough tokens to "think" before committing
- Keep format close to what model has seen naturally (internet text)
- No formatting overhead (counting thousands of lines, string escaping)
- Include example usage, edge cases, input format requirements, clear boundaries
- Test extensively in workbench, iterate on mistakes
- Prefer absolute paths over relative; prefer rewrite over diff (for LLMs)

---

## 2. Vercel AI SDK Design Patterns

**Source:** [AI SDK v6 Docs](https://sdk.vercel.ai/docs)

### Architecture: ToolLoopAgent Class

The `ToolLoopAgent` is the primary agent primitive in AI SDK v6. It encapsulates:

```typescript
const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: "...",
  tools: { /* ... */ },
  stopWhen: stepCountIs(20),       // default loop limit
  prepareStep: async ({ stepNumber, messages }) => { /* dynamic config */ },
  onStepFinish: async ({ stepNumber, usage, toolCalls }) => { /* observability */ },
  output: Output.object({ schema: /* ... */ }),  // structured output
});
```

### Loop Control Patterns

| Mechanism | Purpose |
|---|---|
| `stepCountIs(n)` | Stop after N steps (default: 20) |
| `isLoopFinished()` | Run until model naturally stops (no limit — use cautiously) |
| `hasToolCall(name)` | Stop when specific tool is called |
| Custom `StopCondition` | Budget-based, text-pattern-based, etc. |
| `prepareStep` | Dynamic model/tool/message modification per step |

### Dynamic Step Modification (`prepareStep`)

```typescript
prepareStep: async ({ stepNumber, messages, steps }) => {
  // Phase 1: Search only (steps 0-2)
  if (stepNumber <= 2) return { activeTools: ['search'], toolChoice: 'required' };
  // Phase 2: Analyze only (steps 3-5)
  if (stepNumber <= 5) return { activeTools: ['analyze'] };
  // Phase 3: Summarize
  return { activeTools: ['summarize'], toolChoice: 'required' };
}
```

### Workflow Patterns (AI SDK adoptions of Anthropic's patterns)

1. **Sequential Processing (Chains):** `generateText` → quality check → conditional regenerate
2. **Routing:** Classify with structured output → route to specialized model/system prompt
3. **Parallel Processing:** `Promise.all([...])` of multiple `generateText` calls → aggregate
4. **Orchestrator-Worker:** Orchestrator plans → `Promise.all(plan.files.map(...))` workers
5. **Evaluator-Optimizer:** `while (iterations < MAX)` { evaluate → improve }

### Subagents Pattern

Subagents are a core multi-agent primitive:

```
MainAgent → Tool("research") → ResearchSubagent (own context window, own tools)
         → Tool("code")      → CodeSubagent
```

**Key design decisions:**

| Use Subagents | Avoid Subagents |
|---|---|
| Tasks need 100K+ tokens of exploration | Tasks are simple and focused |
| Parallelize independent research | Sequential processing suffices |
| Context would grow beyond model limits | Context stays manageable |
| Isolate tool access by capability | All tools can safely coexist |

**Critical pattern: `toModelOutput` for context offloading:**
- The subagent uses 100K tokens internally
- `toModelOutput` extracts just the summary (e.g., 1K tokens)
- Main agent stays coherent; users still see full details in UI

**Subagent instructions must include summarization directive:**
> "IMPORTANT: When finished, write a clear summary as your final response. This will be returned to the main agent."

### Forced Tool Calling Pattern

```typescript
const done = tool({
  description: 'Signal completion',
  inputSchema: z.object({ answer: z.string() }),
  // NO execute function → calling this stops the agent
});
// With toolChoice: 'required', model MUST call a tool each step
// It signals completion by calling 'done'
```

---

## 3. Cloudflare Agents SDK

**Source:** [Cloudflare Agents Docs](https://developers.cloudflare.com/agents/)

### Core Architecture

Each agent is a TypeScript class running on a Durable Object — a stateful micro-server with:
- Built-in SQLite database (private per agent instance)
- Real-time WebSocket state sync
- Scheduling (cron, delay, specific time)
- RPC via `@callable()` decorator

```typescript
export class MyAgent extends Agent<Env, State> {
  initialState = { count: 0 };
  
  @callable() increment() {
    this.setState({ count: this.state.count + 1 });
  }
}
```

### State Management Patterns

**State vs. SQL split:**

| Use State For | Use SQL For |
|---|---|
| UI state (loading, selection) | Historical data |
| Real-time counters | Large collections |
| Active session data | Relationships |
| Configuration | Queryable/analytical data |

**State flow:**
```
Client → setState() → SQLite persist → broadcast WebSocket → all clients
                    → onStateChanged(source) → side effects
                    → validateStateChange() → reject if invalid
```

**Key patterns:**
- **Optimistic updates:** Client updates UI instantly, server confirms
- **Source-aware handlers:** `if (source === "server") return;` to avoid infinite loops
- **Agent state as model context:** Query SQL for history → feed into LLM prompt → store response

### Human-in-the-Loop Patterns

| Pattern | Best For | Mechanism |
|---|---|---|
| Workflow Approval | Multi-step processes, durable gates (hours/weeks) | `waitForApproval()` |
| `needsApproval` | AI chat tool calls with confirmation | `needsApproval: ({ amount }) => amount > 100` |
| `onToolCall` | Client-side tools (browser APIs, user interaction) | Client handles tool execution |
| MCP Elicitation | MCP tools needing structured user input | `elicitInput()` with JSON Schema |
| State + WebSocket | Simple confirmations without AI | State flag + client polling |

### Multi-Agent Coordination

- **Sub-agents:** Agents can invoke other agents as sub-agents
- **MCP Agent API:** Expose agent tools to other agents/LLMs via MCP
- **Scheduling:** Agents can wake themselves up (`this.schedule(delay, "method", payload)`)
- **Email-driven agents:** Agents can react to inbound email
- **Workflow orchestration:** Run multi-step workflows with automatic retries and durable execution

---

## 4. General Agent Architecture Patterns

### ReAct (Reasoning + Acting)

```
Thought → Action → Observation → Thought → Action → ... → Final Answer
```

- **What:** Interleave reasoning traces with tool-calling actions
- **When:** Tasks requiring multi-step reasoning with external information retrieval
- **Document pipeline relevance:** Specialist agent thinks about what info it needs, calls search tools, revises based on results
- **Trade-offs:** More observable than pure action, but higher token usage due to verbose reasoning

### Plan-and-Execute

```
Plan (high-level) → Execute (step-by-step) → Replan (if needed) → Execute → ...
```

- **What:** Separate planning from execution — plan first, then execute each planned step
- **When:** Complex multi-step tasks where upfront planning improves execution quality
- **Document pipeline relevance:** Orchestrator creates a document generation plan, then dispatches sections to specialists
- **Trade-offs:** Better structure for complex tasks, but plan may become stale and need revision

### Reflexion

```
Act → Evaluate → Verbal Self-Reflection → Retry with improved approach
```

- **What:** Agent reflects on failures verbally, stores learnings, applies to next attempt
- **When:** Tasks where initial attempts often fail and can be improved through self-critique
- **Document pipeline relevance:** After evaluator rejects a section, specialist reflects on why it was rejected before rewriting
- **Trade-offs:** Improves quality through meta-cognition, but adds significant token cost per reflection

### Tree of Thoughts (ToT)

```
Root → Branch A → Sub-branch A1 → ...
     → Branch B → Sub-branch B1 → ...
     → Branch C → ...
     
Evaluate branches → Prune → Expand best → Repeat
```

- **What:** Explore multiple reasoning paths in parallel, evaluate, prune, expand best
- **When:** Tasks with many possible approaches and a clear evaluation criterion
- **Document pipeline relevance:** Debate orchestrator explores multiple document structures, evaluates each, picks best
- **Trade-offs:** Highest quality potential, but massive token cost; only justified for highest-value decisions

### Agent Protocol Standards

Emerging standardization efforts:
- **MCP (Model Context Protocol):** Anthropic's open standard for tool definition and agent-server communication
- **JSON Schema for tool definitions:** Adopted by OpenAI, Anthropic, Vercel AI SDK, Cloudflare
- **A2A (Agent-to-Agent):** Google's protocol for agent interoperability (emerging)
- **OpenAPI for tools:** Some frameworks support wrapping OpenAPI specs as agent tools

---

## 5. Multi-Agent System Patterns

### Communication Patterns

| Pattern | Description | Document Pipeline Use |
|---|---|---|
| **Direct Message** | Agent A sends to Agent B directly | Orchestrator → Specialist: "Generate PRD section 3" |
| **Broadcast** | One agent sends to all | Orchestrator announces document structure to all specialists |
| **Blackboard** | Shared workspace where agents read/write | Shared document artifact that all specialists contribute to |
| **Marketplace** | Agents bid on tasks, winner executes | Specialists bid on which sections they're best suited to write |
| **Publish/Subscribe** | Agents subscribe to topics, receive relevant messages | Specialists subscribe to sections matching their expertise |

### Coordination Patterns

| Pattern | Description | When to Use |
|---|---|---|
| **Consensus** | All agents must agree before proceeding | Critical decisions (security posture, architecture choices) |
| **Voting** | Majority determines outcome | Non-critical decisions with subjective answers |
| **Auction** | Agents bid; highest-value bid wins | Resource allocation, task assignment |
| **Delegation** | One agent assigns to another | Clear hierarchy with specialized expertise |
| **Debate** | Agents argue positions, judge selects winner | Decisions with strong trade-offs requiring adversarial testing |

### Conflict Resolution

```
Agent A output ──→ [Conflict?] ──→ Mediator Agent evaluates
Agent B output ──→              ──→ Mediator decides OR requests revision
```

- **Mediator pattern:** Third agent evaluates conflicting outputs based on defined criteria
- **Escalation pattern:** Conflicts escalate to higher-capability model or human
- **Evidence-based resolution:** Agents must cite evidence for positions; best-evidenced wins
- **Compromise generation:** Combine elements from conflicting outputs into a coherent hybrid

### Shared Memory / Knowledge Base

| Approach | Mechanism | Trade-off |
|---|---|---|
| **Centralized context** | All agents see same messages | Simple, but context grows rapidly |
| **Summary-based** | Each agent produces summary, others read summaries only | Efficient, but information loss |
| **Vector store** | Embed and retrieve relevant knowledge | Scalable, but retrieval quality varies |
| **Hierarchical memory** | Short-term (conversation), long-term (vector DB) | Best of both, but complex |
| **Event sourcing** | All agent actions logged as events, replayable | Auditable, but storage cost |

---

## 6. Production Agent Best Practices

### Error Handling for LLM Calls

```
LLM Call → [Success] → Continue
         → [Rate Limit] → Exponential backoff → retry (max 3)
         → [Timeout] → Retry with smaller prompt OR fallback model
         → [Content Filter] → Rewrite prompt without flagged content
         → [Context Length] → Truncate oldest messages → retry
         → [Persistent Error] → Circuit breaker → graceful degradation
```

| Pattern | Mechanism |
|---|---|
| **Retry with backoff** | Exponential backoff (1s, 2s, 4s, 8s) for transient errors |
| **Fallback models** | Primary: Sonnet 4.5 → Fallback: Haiku 4.5 → Fallback: GPT-4o-mini |
| **Circuit breaker** | After N consecutive failures, stop calling and return error |
| **Graceful degradation** | If specialist fails, return partial output with caveat |
| **Timeout management** | Set per-call timeouts; cancel and retry if exceeded |
| **Idempotency** | Idempotency keys for state-changing operations |

### Rate Limiting & Token Budget Management

```typescript
// Custom stop condition based on cost
const budgetExceeded: StopCondition<typeof tools> = ({ steps }) => {
  const totalCost = steps.reduce((acc, step) => acc + estimateCost(step.usage), 0);
  return totalCost > 0.50; // Stop if > $0.50
};
```

- **Token budgets per document:** Set max tokens per document generation (e.g., 100K input, 16K output)
- **Concurrency limits:** Max N parallel specialist agents to control API rate limit usage
- **Tiered model usage:** Fast/cheap models for classification, powerful models for generation
- **Caching:** Cache identical prompts/responses (e.g., template sections)

### Streaming Patterns

| Pattern | Use |
|---|---|
| **Full streaming** | `streamText` for real-time display to user |
| **Step-based streaming** | Stream after each specialist completes their section |
| **Preliminary results** | Subagent yields intermediate results via generator |
| **UIMessage streaming** | `readUIMessageStream` for accumulated display |
| **SSE (Server-Sent Events)** | HTTP streaming of agent progress |

### Observability

**What to capture:**

| Metric | How |
|---|---|
| **Token usage** (input/output per step) | `onStepFinish` callback |
| **Step count** | Built-in loop tracking |
| **Tool calls** (which tools, inputs, outputs) | `onStepFinish` + DevTools |
| **Latency** (total + per step) | Wrapper around `generateText` |
| **Error rate** (by type: rate limit, timeout, content filter) | Error aggregation |
| **Cost** (estimated from token usage) | Custom stop condition + logging |
| **Success rate** (evaluator pass/fail) | Evaluator output tracking |

**AI SDK DevTools:**
- Captures all LLM requests, responses, tool calls, token usage
- Groups into runs (complete interactions) and steps (individual calls)
- Local viewer at `http://localhost:4983`
- Stores in `.devtools/generations.json` (auto-gitignored)

### Security Patterns

**Prompt injection prevention:**
- Separate system prompt from user input (different message roles)
- Input validation/sanitization before passing to LLM
- Never let LLM output be directly executed as code without sandboxing
- Rate limit user messages per session

**Tool access control:**
- Principle of least privilege: agents only get tools they need
- Read-only tools for analysis agents, write tools for generation agents
- `needsApproval` for destructive operations (Cloudflare pattern)
- Tool scoping by agent role (orchestrator vs. worker)

**Sandboxing:**
- Run untrusted code in isolated environments (Cloudflare Sandbox SDK, Vercel Sandbox)
- File system access limited to specific directories
- Network access whitelisting per agent

---

## 7. Document Generation Pipeline — Applied Patterns

### Recommended Architecture

```
                      ┌──────────────────┐
                      │   Request Router  │ (Pattern: Routing)
                      └────────┬─────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
        ┌──────────┐    ┌──────────┐     ┌──────────┐
        │ PRD Flow  │    │ ADR Flow │     │ SRS Flow │
        └─────┬─────┘    └─────┬────┘     └─────┬────┘
              │                │                 │
              └────────────────┼─────────────────┘
                               ▼
                    ┌────────────────────┐
                    │ Document Orchestrator│ (Pattern: Orchestrator-Workers)
                    └────────┬───────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                   ▼
   ┌────────────┐    ┌────────────┐      ┌────────────┐
   │ Section Gen │    │ Section Gen │      │ Section Gen │  (Pattern: Parallel)
   └──────┬──────┘    └──────┬─────┘      └──────┬─────┘
          │                  │                    │
          └──────────────────┼────────────────────┘
                             ▼
                    ┌─────────────────┐
                    │  Debate/Aggregator│ (Pattern: Voting/Consensus)
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ Quality Evaluator│ (Pattern: Evaluator-Optimizer)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Final Output    │
                    └─────────────────┘
```

### Specialist Agent Design

```typescript
const prdSpecialist = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: `You are a PRD writing specialist.
    Follow this structure: Problem Statement → User Stories → Requirements → Success Metrics.
    Be specific, measurable, and actionable. Avoid vague language.`,
  tools: {
    search: marketResearchTool,
    readTemplate: templateReader,
  },
  output: Output.object({
    schema: prdSectionSchema,
  }),
  stopWhen: stepCountIs(10),
});
```

### Debate Orchestrator Design

```typescript
// Agents generate independent positions
const positions = await Promise.all([
  agentA.generate({ prompt: "Argue for microservices architecture" }),
  agentB.generate({ prompt: "Argue for monolith architecture" }),
  agentC.generate({ prompt: "Argue for modular monolith" }),
]);

// Judge evaluates all positions
const decision = await judge.generate({
  prompt: `Evaluate these architectural positions:
    ${positions.map((p, i) => `Position ${i}: ${p.text}`).join('\n')}
    Choose the best approach with reasons.`,
});

// Devil's advocate challenges the winner
const critique = await devilAdvocate.generate({
  prompt: `Challenge this decision: ${decision.text}. Find weaknesses.`,
});

// Winner responds to critique
const final = await winner.generate({
  prompt: `Respond to this critique: ${critique.text}. Revise if needed.`,
});
```

### Key Design Principles for Document Pipelines

1. **Separation of generation from evaluation:** Never let the same agent evaluate its own output
2. **Multiple perspectives before finalization:** Use parallel specialists + debate for quality
3. **Template-driven output:** Specialists write to structured schemas/templates for consistency
4. **Stage-gated pipeline:** Each stage has clear acceptance criteria before proceeding
5. **Human-in-the-loop at critical junctures:** Architecture decisions, security postures
6. **Context isolation for specialists:** Each specialist gets only relevant context, not full history
7. **Cost-tiered model selection:** Haiku for classification, Sonnet for generation, Opus for evaluation
8. **Immutable audit trail:** Every agent output, evaluation, and decision is logged and versioned

---

## Summary: Pattern Selection Guide

| Your Need | Pattern | Why |
|---|---|---|
| Generate document from simple prompt | Prompt Chaining | Clear sequential steps |
| Handle multiple doc types (PRD, ADR, SRS) | Routing | Different specialists per type |
| Review from multiple angles at once | Parallelization (Sectioning) | Security + perf + style simultaneously |
| Unknown scope, dynamic task breakdown | Orchestrator-Workers | LLM decides subtasks |
| Need to refine until quality threshold | Evaluator-Optimizer | Iterate with feedback |
| Need multiple independent opinions | Parallelization (Voting) | Diverse perspectives |
| Resolve conflicting specialist outputs | Debate + Judge | Structured adversarial evaluation |
| Large context, but agent must stay focused | Subagents + toModelOutput | Offload exploration, summarize back |
| Long-running pipeline with wait states | Workflow Approval (HITL) | Durable pause for human review |
