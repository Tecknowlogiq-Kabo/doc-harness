import type { Agent } from "../agents/agent-factory";
import { intakeAgent } from "../agents/orchestrator/intake-agent";
import { discoveryAgent } from "../agents/orchestrator/discovery-agent";
import { reviewerAgent } from "../agents/orchestrator/reviewer-agent";
import { runDebate } from "../agents/debate/debate-orchestrator";
import { scoreDocument, passesHardThresholds } from "../scorers/document-scorers";
import {
  prdAgent, ideaAgent, planAgent,
  mrdAgent, brdAgent, urdAgent,
  brsAgent, strsAgent, syrsAgent, srsAgent,
  adrAgent, rfcAgent, ruleAgent, guideAgent, specAgent, docAgent,
  taskTypeAgent, cpatAgent,
} from "../agents/specialists";
import type {
  DocumentManifest, DocTarget, GeneratedDocument,
  PipelineEvent, DocumentRelation,
} from "../types";
import { GeneratedDocumentSchema } from "../types";
import { getDocTypeEntry, getSuggestedRelations, getAgentId } from "../registry/doc-type-registry";
import { extractSections } from "../utils/extract-sections";

const specialistMap: Record<string, Agent> = {
  "prd-agent": prdAgent, "idea-agent": ideaAgent, "plan-agent": planAgent,
  "mrd-agent": mrdAgent, "brd-agent": brdAgent, "urd-agent": urdAgent,
  "brs-agent": brsAgent, "strs-agent": strsAgent, "syrs-agent": syrsAgent, "srs-agent": srsAgent,
  "adr-agent": adrAgent, "rfc-agent": rfcAgent, "rule-agent": ruleAgent,
  "guide-agent": guideAgent, "spec-agent": specAgent, "doc-agent": docAgent,
  "task-type-agent": taskTypeAgent, "cpat-agent": cpatAgent,
};

export type PipelineEmitter = (event: PipelineEvent) => void;
export type PipelineResult = {
  documents: GeneratedDocument[];
  relations: DocumentRelation[];
  manifest: DocumentManifest;
};

export async function runPipeline(
  userPrompt: string,
  emit: PipelineEmitter,
  signal?: AbortSignal
): Promise<PipelineResult> {
  emit({ phase: "intake", docs: [] });

  if (signal?.aborted) throw new Error("Pipeline cancelled");

  const intakeResult = await intakeAgent.generate(
    `User prompt: "${userPrompt}"\n\nClassify this prompt and determine which document types to generate. Use the docTypeClassifier tool.`,
    signal
  );

  const manifest: DocumentManifest = { userPrompt, docs: [] };
  try {
    const parsed = JSON.parse(extractJSON(intakeResult.text));
    manifest.docs = parsed.docs || [];
  } catch {
    manifest.docs = [
      { type: "prd", slug: "requirements-prd", title: "Product Requirements", track: "vision" },
      { type: "adr", slug: "architecture-adr", title: "Architecture Decisions", track: "knowledge" },
      { type: "plan", slug: "implementation-plan", title: "Implementation Plan", track: "vision" },
    ];
  }

  emit({ phase: "intake", docs: manifest.docs });

  emit({ phase: "discovery", progress: 0, facts: 0 });

  if (signal?.aborted) throw new Error("Pipeline cancelled");

  const docTypeList = manifest.docs.map((d) => d.type).join(", ");
  const discoveryResult = await discoveryAgent.generate(
    `Build domain knowledge for: "${userPrompt}"\n\nDocument types to generate: ${docTypeList}`,
    signal
  );
  const domainContext = discoveryResult.text;

  emit({ phase: "discovery", progress: 100, facts: 5 });

  const totalDocs = manifest.docs.length;

  if (signal?.aborted) throw new Error("Pipeline cancelled");

  const CONCURRENCY = 4;
  const validDocs: GeneratedDocument[] = [];
  let completedCount = 0;

  for (let i = 0; i < manifest.docs.length; i += CONCURRENCY) {
    if (signal?.aborted) throw new Error("Pipeline cancelled");
    const batch = manifest.docs.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (docTarget) => {
        emit({
          phase: "generation",
          docType: docTarget.type,
          slug: docTarget.slug,
          status: "started",
          total: totalDocs,
          completed: completedCount,
        });

        try {
          const agent = getAgentForTarget(docTarget);
          const doc = await generateDocument(agent, docTarget, userPrompt, signal, domainContext);
          completedCount++;
          emit({
            phase: "generation",
            docType: docTarget.type,
            slug: docTarget.slug,
            status: "completed",
            total: totalDocs,
            completed: completedCount,
          });
          return doc;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const isRateLimit = msg.includes("429") || msg.includes("rate") || msg.includes("too many");
          const isContentFilter = msg.includes("content") || msg.includes("safety") || msg.includes("filter") || msg.includes("refused");

          if (isRateLimit) {
            emit({
              phase: "error",
              message: `Rate limited during ${docTarget.type}/${docTarget.slug}, retrying in 5s`,
            });
            await new Promise((r) => setTimeout(r, 5000));
            try {
              const agent = getAgentForTarget(docTarget);
              const doc = await generateDocument(agent, docTarget, userPrompt, signal, domainContext);
              completedCount++;
              emit({
                phase: "generation",
                docType: docTarget.type,
                slug: docTarget.slug,
                status: "completed",
                total: totalDocs,
                completed: completedCount,
              });
              return doc;
            } catch (retryErr) {
              emit({
                phase: "generation",
                docType: docTarget.type,
                slug: docTarget.slug,
                status: "failed",
                total: totalDocs,
                completed: completedCount,
              });
              return null;
            }
          }

          if (isContentFilter) {
            emit({
              phase: "error",
              message: `Content filtered for ${docTarget.type}/${docTarget.slug}: ${msg.slice(0, 200)}`,
            });
            emit({
              phase: "generation",
              docType: docTarget.type,
              slug: docTarget.slug,
              status: "failed",
              total: totalDocs,
              completed: completedCount,
            });
            return null;
          }

          emit({
            phase: "generation",
            docType: docTarget.type,
            slug: docTarget.slug,
            status: "failed",
            total: totalDocs,
            completed: completedCount,
          });
          return null;
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value !== null) {
        validDocs.push(r.value);
      }
    }
  }

  const debateBatchSize = 4;
  const debatedDocs: GeneratedDocument[] = [];

  if (signal?.aborted) throw new Error("Pipeline cancelled");

  for (let i = 0; i < validDocs.length; i += debateBatchSize) {
    const batch = validDocs.slice(i, i + debateBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (doc) => {
        const transcript = await runDebate(doc);

        for (const round of transcript.rounds) {
          emit({
            phase: "debate",
            docType: doc.type,
            slug: doc.slug,
            round: round.round,
            role: "advocate",
            argument: round.advocate,
          });
          emit({
            phase: "debate",
            docType: doc.type,
            slug: doc.slug,
            round: round.round,
            role: "skeptic",
            argument: round.skeptic,
          });
        }

        emit({
          phase: "debate-verdict",
          docType: doc.type,
          slug: doc.slug,
          verdict: transcript.verdict,
        });

        return { doc, transcript };
      })
    );

    for (const { doc, transcript } of batchResults) {
      if (transcript.verdict.verdict === "reject") {
        const docTarget = manifest.docs.find((d) => d.slug === doc.slug);
        if (docTarget) {
          emit({
            phase: "generation",
            docType: docTarget.type,
            slug: docTarget.slug,
            status: "started",
            total: totalDocs,
            completed: debatedDocs.length,
          });

          const agent = getAgentForTarget(docTarget);
          const entry = getDocTypeEntry(docTarget.type);
          const result = await agent.generate(
            `Regenerate this document fixing the issues identified during debate.

Original prompt: "${userPrompt}"

${domainContext ? `Domain context: ${domainContext.slice(0, 1000)}\n` : ''}

Debate feedback — issues to fix:
${transcript.verdict.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

${transcript.verdict.suggestedFixes?.length ? `\nSuggested fixes:\n${transcript.verdict.suggestedFixes.map((f, idx) => `${idx + 1}. ${f}`).join('\n')}` : ''}

Generate a ${entry.label} (${docTarget.type}).
Document slug: ${docTarget.slug}
Document title: ${docTarget.title}

Use the referenceMaterial tool to check section requirements.`,
            signal
          );
          const regenerated = parseDocumentOutput(docTarget, result.text);
          debatedDocs.push(regenerated);
          continue;
        }
      }
      debatedDocs.push(doc);
    }
  }

  const reviewedDocs: GeneratedDocument[] = [];
  for (const doc of debatedDocs) {
    const scores = scoreDocument(doc);
    emit({ phase: "review", slug: doc.slug, scores });

    if (scores.overall < 0.7 || !passesHardThresholds(scores)) {
      const escalated = await escalateWithSupervisor(doc, scores, userPrompt, signal, domainContext);
      if (escalated) {
        reviewedDocs.push(escalated);
        continue;
      }
    }

    if (scores.overall >= 0.85) {
      try {
        const reviewerResult = await reviewerAgent.generate(
          `Review this document for quality:\n\n${doc.content}\n\nHeuristic scores: completeness=${scores.completeness}, format=${scores.format}, clarity=${scores.clarity}, depth=${scores.depth}`,
          signal
        );
        emit({ phase: "review", slug: doc.slug, scores, reviewerNotes: reviewerResult.text });
      } catch {
        // Reviewer failed, heuristic scores are sufficient
      }
    }

    reviewedDocs.push(doc);
  }

  const relations = mapRelations(reviewedDocs);

  const consistencyWarnings = await checkCrossDocumentConsistency(reviewedDocs, relations, signal);
  if (consistencyWarnings.length > 0) {
    for (const warning of consistencyWarnings) {
      emit({ phase: "error", message: `[consistency] ${warning}` });
    }
  }

  for (const doc of reviewedDocs) {
    emit({ phase: "assembly", slug: doc.slug, status: "linked" });
    emit({ phase: "assembly", slug: doc.slug, status: "written" });
  }

  const result: PipelineResult = { documents: reviewedDocs, relations, manifest };
  emit({ phase: "complete", outputDir: "docs/", docCount: reviewedDocs.length });
  emit({ phase: "result", result });

  return result;
}

function getAgentForTarget(target: DocTarget): Agent {
  return specialistMap[getAgentId(target.type)] ?? prdAgent;
}

async function negotiateSprint(
  agent: Agent,
  target: DocTarget,
  userPrompt: string,
  domainContext: string,
  signal?: AbortSignal
): Promise<string[]> {
  const entry = getDocTypeEntry(target.type);

  const result = await agent.generate(
    `Before generating the ${entry.label}, propose a sprint plan. 

User prompt: "${userPrompt}"
${domainContext ? `Domain context: ${domainContext.slice(0, 1000)}` : ''}

Document type: ${target.type} (${entry.label})
Required sections: ${entry.requiredSections.join(', ')}
Description: ${entry.description}

Respond ONLY with a JSON object:
{
  "sections": ["Section 1 name", "Section 2 name", ...],
  "approach": "brief description of how you'll write this document",
  "risks": ["any potential gaps or challenges"]
}

Make sure your sections list covers ALL required sections: ${entry.requiredSections.join(', ')}`,
    signal
  );

  try {
    const plan = JSON.parse(extractJSON(result.text));
    const planned = (plan.sections ?? []).map((s: string) => s.toLowerCase());
    const missing = entry.requiredSections.filter(
      (req) => !planned.some((p: string) => p.includes(req.toLowerCase()))
    );
    if (missing.length > 0) {
      console.warn(`Sprint plan for ${target.slug} missing required sections: ${missing.join(', ')}`);
    }
    return plan.sections ?? entry.requiredSections;
  } catch {
    return entry.requiredSections;
  }
}

async function generateDocument(
  agent: Agent,
  target: DocTarget,
  userPrompt: string,
  signal?: AbortSignal,
  domainContext?: string
): Promise<GeneratedDocument> {
  const entry = getDocTypeEntry(target.type);

  const sprintSections = await negotiateSprint(agent, target, userPrompt, domainContext ?? "", signal);

  const result = await agent.generate(
    `Generate a ${entry.label} (${target.type}) based on this user prompt:

"${userPrompt}"

${domainContext ? `Domain context from research:\n${domainContext.slice(0, 2000)}\n` : ''}

Sprint plan — sections to produce:
${sprintSections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Document slug: ${target.slug}
Document title: ${target.title}

Use the referenceMaterial tool to check section requirements.
Use the knowledgeBuilder tool for domain context.
Generate all required sections with substantive content.

First think about what this document needs, then generate it section by section.`,
    signal
  );

  return parseDocumentOutput(target, result.text);
}

function parseDocumentOutput(
  target: DocTarget,
  text: string
): GeneratedDocument {
  const sections = extractSections(text);

  const doc = {
    slug: target.slug,
    type: target.type,
    title: target.title,
    content: text,
    sections: sections.length > 0 ? sections : [
      { heading: "Overview", body: text.slice(0, 500) },
    ],
  };

  const validated = GeneratedDocumentSchema.safeParse(doc);
  if (!validated.success) {
    console.warn("[pipeline] Generated document failed Zod validation:", validated.error.flatten());
  }

  return doc as GeneratedDocument;
}

async function selfCorrectDocument(
  doc: GeneratedDocument,
  scores: { completeness: number; format: number; clarity: number; depth: number; crossRef: number; overall: number; issues: string[] },
  signal?: AbortSignal
): Promise<GeneratedDocument> {
  const agent = specialistMap[getAgentId(doc.type)] ?? prdAgent;

  const result = await agent.generate(
    `Revise this document to address quality issues:

Current scores: completeness=${scores.completeness}, format=${scores.format}, clarity=${scores.clarity}, depth=${scores.depth}, crossRef=${scores.crossRef}

Issues to fix:
${scores.issues.map((i) => `- ${i}`).join("\n")}

Original document:
${doc.content}

Generate an improved version that fixes all identified issues.`,
    signal
  );

  const sections = extractSections(result.text);
  return {
    ...doc,
    content: result.text,
    sections: sections.length > 0 ? sections : doc.sections,
  };
}

// Tracks per-document escalation attempts within a single pipeline run.
// Must be module-scoped so the counter persists across multiple calls
// for the same doc slug (e.g., on re-verification after self-correction).
const escalationAttempts = new Map<string, number>();

async function escalateWithSupervisor(
  doc: GeneratedDocument,
  scores: { completeness: number; format: number; clarity: number; depth: number; crossRef: number; overall: number; issues: string[] },
  userPrompt: string,
  signal?: AbortSignal,
  domainContext?: string
): Promise<GeneratedDocument | null> {
  const key = doc.slug;

  if (signal?.aborted) throw new Error("Pipeline cancelled");

  const attempt = escalationAttempts.get(key) ?? 0;
  escalationAttempts.set(key, attempt + 1);

  if (attempt >= 2) {
    return null;
  }

  try {
    if (attempt === 0) {
      const improved = await selfCorrectDocument(doc, scores, signal);
      const newScores = scoreDocument(improved);
      if (newScores.overall >= 0.7) return improved;
      escalationAttempts.set(key, 1);
    }

    if (attempt <= 1) {
      const alternateAgent = getAlternateAgent(doc.type);
      if (alternateAgent) {
        const regenerated = await generateDocument(
          alternateAgent,
          { type: doc.type, slug: doc.slug, title: doc.title, track: "vision" },
          userPrompt,
          signal,
          domainContext
        );
        const newScores = scoreDocument(regenerated);
        if (newScores.overall >= 0.7) return regenerated;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getAlternateAgent(type: string): Agent | null {
  const alternateMap: Record<string, string> = {
    prd: "brd-agent",
    brd: "prd-agent",
    srs: "syrs-agent",
    syrs: "srs-agent",
    spec: "rfc-agent",
    rfc: "spec-agent",
    guide: "doc-agent",
    doc: "guide-agent",
  };
  const alternateId = alternateMap[type];
  return alternateId ? (specialistMap[alternateId] ?? null) : null;
}

export function mapRelations(docs: GeneratedDocument[]): DocumentRelation[] {
  const relations: DocumentRelation[] = [];
  const slugsByType = new Map<string, string>();

  for (const doc of docs) {
    slugsByType.set(doc.type, doc.slug);
  }

  for (const doc of docs) {
    const suggested = getSuggestedRelations(doc.type);
    for (const rel of suggested) {
      const targetSlug = slugsByType.get(rel.targetType);
      if (targetSlug && targetSlug !== doc.slug) {
        const exists = relations.some(
          (r) => r.source === doc.slug && r.target === targetSlug && r.type === rel.relation
        );
        if (!exists) {
          relations.push({
            source: doc.slug,
            target: targetSlug,
            type: rel.relation,
          });
        }
      }
    }
  }

  return relations;
}

async function checkCrossDocumentConsistency(
  docs: GeneratedDocument[],
  relations: DocumentRelation[],
  signal?: AbortSignal
): Promise<string[]> {
  const warnings: string[] = [];

  for (const rel of relations) {
    if (signal?.aborted) break;

    const source = docs.find(d => d.slug === rel.source);
    const target = docs.find(d => d.slug === rel.target);
    if (!source || !target) continue;

    const sourceLower = source.content.toLowerCase();
    const targetLower = target.content.toLowerCase();

    const techTerms = ["postgresql", "mongodb", "mysql", "redis", "sqlite", "dynamodb", "kafka", "rabbitmq"];
    const sourceTechs = techTerms.filter(t => sourceLower.includes(t));
    const targetTechs = techTerms.filter(t => targetLower.includes(t));

    for (const st of sourceTechs) {
      for (const tt of targetTechs) {
        if (st !== tt && techTerms.includes(st) && techTerms.includes(tt)) {
          warnings.push(
            `Cross-document inconsistency: ${source.slug} mentions "${st}" while ${target.slug} mentions "${tt}"`
          );
        }
      }
    }

    const sourceMusts = extractMusts(source.content);
    const targetMusts = extractMusts(target.content);
    for (const [key, val] of Object.entries(sourceMusts)) {
      if (targetMusts[key] && targetMusts[key] !== val) {
        warnings.push(
          `Cross-document contradiction: ${source.slug} requires "${key}: ${val}" but ${target.slug} requires "${key}: ${targetMusts[key]}"`
        );
      }
    }
  }

  return warnings;
}

function extractMusts(content: string): Record<string, string> {
  const musts: Record<string, string> = {};
  const regex = /\b(must|shall|must not|shall not|should|should not)\s+(\w[\w\s]{5,80})/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    musts[match[0].slice(0, 60)] = match[1];
  }
  return musts;
}

function extractJSON(text: string): string {
  const jsonBlock = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlock) return jsonBlock[1].trim();
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}
