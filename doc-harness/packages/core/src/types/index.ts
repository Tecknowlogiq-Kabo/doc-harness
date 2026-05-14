import { z } from "zod";

export const DocumentTypeSchema = z.enum([
  "prd", "idea", "plan",
  "mrd", "brd", "urd",
  "brs", "strs", "syrs", "srs",
  "adr", "rfc", "rule", "guide", "spec", "doc",
  "task-type", "cpat",
]);

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentTrackSchema = z.enum(["vision", "knowledge", "experience"]);

export type DocumentTrack = z.infer<typeof DocumentTrackSchema>;

export const VerdictSchema = z.enum(["approve", "revise", "reject"]);

export type Verdict = z.infer<typeof VerdictSchema>;

export const PipelinePhaseSchema = z.enum([
  "intake", "discovery", "generation", "debate", "review", "assembly",
]);

export type PipelinePhase = z.infer<typeof PipelinePhaseSchema>;

export const DocTargetSchema = z.object({
  type: DocumentTypeSchema,
  slug: z.string(),
  title: z.string(),
  track: DocumentTrackSchema,
});

export type DocTarget = z.infer<typeof DocTargetSchema>;

export const DocumentManifestSchema = z.object({
  userPrompt: z.string(),
  docs: z.array(DocTargetSchema),
});

export type DocumentManifest = z.infer<typeof DocumentManifestSchema>;

export const GeneratedDocumentSchema = z.object({
  slug: z.string(),
  type: DocumentTypeSchema,
  title: z.string(),
  content: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    body: z.string(),
  })),
});

export type GeneratedDocument = z.infer<typeof GeneratedDocumentSchema>;

export const ScoreSchema = z.object({
  completeness: z.number().min(0).max(1),
  format: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  depth: z.number().min(0).max(1),
  crossRef: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
  issues: z.array(z.string()),
});

export type Score = z.infer<typeof ScoreSchema>;

export const RelationTypeSchema = z.enum([
  "implements", "extends", "depends_on", "related",
]);

export type RelationType = z.infer<typeof RelationTypeSchema>;

export const DocumentRelationSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: RelationTypeSchema,
});

export type DocumentRelation = z.infer<typeof DocumentRelationSchema>;

export const DebateRoundSchema = z.object({
  round: z.number(),
  role: z.enum(["advocate", "skeptic", "mediator"]),
  argument: z.string(),
});

export type DebateRound = z.infer<typeof DebateRoundSchema>;

export const DebateVerdictSchema = z.object({
  verdict: VerdictSchema,
  reasoning: z.string(),
  praises: z.array(z.string()),
  issues: z.array(z.string()),
  suggestedFixes: z.array(z.string()).optional(),
});

export type DebateVerdict = z.infer<typeof DebateVerdictSchema>;

export const PipelineEventSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("intake"), docs: z.array(DocTargetSchema) }),
  z.object({ phase: z.literal("discovery"), progress: z.number(), facts: z.number() }),
  z.object({ phase: z.literal("generation"), docType: DocumentTypeSchema, slug: z.string(), status: z.enum(["started", "completed", "failed"]), total: z.number(), completed: z.number() }),
  z.object({ phase: z.literal("debate"), docType: DocumentTypeSchema, slug: z.string(), round: z.number(), role: z.string(), argument: z.string() }),
  z.object({ phase: z.literal("debate-verdict"), docType: DocumentTypeSchema, slug: z.string(), verdict: DebateVerdictSchema }),
  z.object({ phase: z.literal("review"), slug: z.string(), scores: ScoreSchema, reviewerNotes: z.string().optional() }),
  z.object({ phase: z.literal("assembly"), slug: z.string(), status: z.enum(["linked", "written"]) }),
  z.object({ phase: z.literal("complete"), outputDir: z.string(), docCount: z.number() }),
  z.object({ phase: z.literal("result"), result: z.object({
    documents: z.array(GeneratedDocumentSchema),
    relations: z.array(DocumentRelationSchema),
    manifest: DocumentManifestSchema,
  }) }),
  z.object({ phase: z.literal("error"), message: z.string() }),
]);

export type PipelineEvent = z.infer<typeof PipelineEventSchema>;
