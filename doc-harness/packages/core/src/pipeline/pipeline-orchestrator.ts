import type { Agent } from "../agents/agent-factory";
import { intakeAgent } from "../agents/orchestrator/intake-agent";
import { discoveryAgent } from "../agents/orchestrator/discovery-agent";
import { reviewerAgent } from "../agents/orchestrator/reviewer-agent";
import { runDebate } from "../agents/debate/debate-orchestrator";
import { scoreDocument } from "../scorers/document-scorers";
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
  await discoveryAgent.generate(
    `Build domain knowledge for: "${userPrompt}"\n\nDocument types to generate: ${docTypeList}`,
    signal
  );

  emit({ phase: "discovery", progress: 100, facts: 5 });

  const totalDocs = manifest.docs.length;

  if (signal?.aborted) throw new Error("Pipeline cancelled");

  const generatePromises = manifest.docs.map(async (docTarget) => {
    emit({
      phase: "generation",
      docType: docTarget.type,
      slug: docTarget.slug,
      status: "started",
      total: totalDocs,
      completed: 0,
    });

    try {
      const agent = getAgentForTarget(docTarget);
      const doc = await generateDocument(agent, docTarget, userPrompt, signal);

      emit({
        phase: "generation",
        docType: docTarget.type,
        slug: docTarget.slug,
        status: "completed",
        total: totalDocs,
        completed: 0,
      });

      return doc;
    } catch {
      emit({
        phase: "generation",
        docType: docTarget.type,
        slug: docTarget.slug,
        status: "failed",
        total: totalDocs,
        completed: 0,
      });
      return null;
    }
  });

  const results = await Promise.allSettled(generatePromises);
  const validDocs = results
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => (r as PromiseFulfilledResult<GeneratedDocument>).value);

  const completedCount = validDocs.length;
  for (const doc of validDocs) {
    emit({
      phase: "generation",
      docType: doc.type,
      slug: doc.slug,
      status: "completed",
      total: totalDocs,
      completed: completedCount,
    });
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
          const regenerated = await generateDocument(agent, docTarget, userPrompt, signal);
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

    if (scores.overall < 0.7) {
      const escalated = await escalateWithSupervisor(doc, scores, userPrompt, signal);
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

async function generateDocument(
  agent: Agent,
  target: DocTarget,
  userPrompt: string,
  signal?: AbortSignal
): Promise<GeneratedDocument> {
  const entry = getDocTypeEntry(target.type);

  const result = await agent.generate(
    `Generate a ${entry.label} (${target.type}) based on this user prompt:

"${userPrompt}"

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

  return {
    slug: target.slug,
    type: target.type,
    title: target.title,
    content: text,
    sections: sections.length > 0 ? sections : [
      { heading: "Overview", body: text.slice(0, 500) },
    ],
  };
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
  signal?: AbortSignal
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
          signal
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

function extractJSON(text: string): string {
  const jsonBlock = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlock) return jsonBlock[1].trim();
  const match = text.match(/\{(?:[^{}]|\{[^{}]*\})*\}/);
  return match ? match[0] : "{}";
}
