import type { DocumentType, DocumentTrack, RelationType } from "../types";

interface DocTypeEntry {
  type: DocumentType;
  track: DocumentTrack;
  label: string;
  description: string;
  requiredSections: string[];
  defaultRelations: { targetType: DocumentType; relation: RelationType }[];
  agentId: string;
  template: string;
}

export const docTypeRegistry: Record<DocumentType, DocTypeEntry> = {
  prd: {
    type: "prd",
    track: "vision",
    label: "Product Requirements Document",
    description: "Product requirements with goals, scope, and acceptance criteria",
    requiredSections: ["Vision", "Problem Statement", "Goals & Success Metrics", "Requirements"],
    defaultRelations: [
      { targetType: "idea", relation: "implements" },
      { targetType: "plan", relation: "implements" },
    ],
    agentId: "prd-agent",
    template: "prd",
  },
  idea: {
    type: "idea",
    track: "vision",
    label: "Concept to Explore",
    description: "A product or technical concept that needs capturing before fully formed",
    requiredSections: ["Idea", "Value", "Possible Implementation", "Risks & Constraints"],
    defaultRelations: [
      { targetType: "prd", relation: "implements" },
    ],
    agentId: "idea-agent",
    template: "idea",
  },
  plan: {
    type: "plan",
    track: "vision",
    label: "Implementation Plan",
    description: "An actionable plan with phased tasks and acceptance criteria",
    requiredSections: ["Goal", "Tasks (phased)", "Acceptance Criteria", "Dependencies"],
    defaultRelations: [
      { targetType: "prd", relation: "depends_on" },
      { targetType: "adr", relation: "depends_on" },
    ],
    agentId: "plan-agent",
    template: "plan",
  },
  mrd: {
    type: "mrd",
    track: "vision",
    label: "Market Requirements Document",
    description: "Market analysis covering TAM/SAM/SOM and competitive landscape",
    requiredSections: ["Market Overview", "TAM/SAM/SOM", "Competitive Landscape", "Market Needs", "Timing"],
    defaultRelations: [
      { targetType: "brd", relation: "related" },
      { targetType: "brs", relation: "implements" },
    ],
    agentId: "mrd-agent",
    template: "mrd",
  },
  brd: {
    type: "brd",
    track: "vision",
    label: "Business Requirements Document",
    description: "Business justification with objectives, ROI, stakeholders, budget, and constraints",
    requiredSections: ["Objectives", "ROI", "Stakeholders", "Budget", "Constraints"],
    defaultRelations: [
      { targetType: "mrd", relation: "extends" },
    ],
    agentId: "brd-agent",
    template: "brd",
  },
  urd: {
    type: "urd",
    track: "vision",
    label: "User Requirements Document",
    description: "User needs through personas, journeys, usability requirements, and acceptance criteria",
    requiredSections: ["Personas", "User Journeys", "Usability Requirements", "Acceptance Criteria"],
    defaultRelations: [
      { targetType: "prd", relation: "related" },
      { targetType: "strs", relation: "implements" },
    ],
    agentId: "urd-agent",
    template: "urd",
  },
  brs: {
    type: "brs",
    track: "vision",
    label: "Business Requirements Specification",
    description: "ISO-structured business requirements: mission, goals, operational concept, success criteria",
    requiredSections: ["Mission", "Business Goals", "Operational Concept", "Success Criteria"],
    defaultRelations: [
      { targetType: "strs", relation: "implements" },
    ],
    agentId: "brs-agent",
    template: "brs",
  },
  strs: {
    type: "strs",
    track: "vision",
    label: "Stakeholder Requirements Specification",
    description: "Per-stakeholder-class requirements with concept of operations and compliance",
    requiredSections: ["Stakeholder Classes", "Per-Class Requirements", "ConOps", "Compliance"],
    defaultRelations: [
      { targetType: "brs", relation: "extends" },
      { targetType: "syrs", relation: "implements" },
    ],
    agentId: "strs-agent",
    template: "strs",
  },
  syrs: {
    type: "syrs",
    track: "vision",
    label: "System Requirements Specification",
    description: "System boundary, interfaces, modes, and verification approach",
    requiredSections: ["System Boundary", "Interfaces", "Modes of Operation", "Verification Approach"],
    defaultRelations: [
      { targetType: "strs", relation: "extends" },
      { targetType: "srs", relation: "implements" },
    ],
    agentId: "syrs-agent",
    template: "syrs",
  },
  srs: {
    type: "srs",
    track: "vision",
    label: "Software Requirements Specification",
    description: "Per-function and per-endpoint specifications with verification matrix",
    requiredSections: ["Functional Requirements", "Interface Requirements", "Verification Matrix"],
    defaultRelations: [
      { targetType: "syrs", relation: "extends" },
    ],
    agentId: "srs-agent",
    template: "srs",
  },
  adr: {
    type: "adr",
    track: "knowledge",
    label: "Architecture Decision Record",
    description: "Records a decision that has been made",
    requiredSections: ["Context", "Decision", "Alternatives Considered", "Consequences"],
    defaultRelations: [
      { targetType: "rfc", relation: "related" },
      { targetType: "rule", relation: "related" },
    ],
    agentId: "adr-agent",
    template: "adr",
  },
  rfc: {
    type: "rfc",
    track: "knowledge",
    label: "Request for Comments",
    description: "Proposes a significant change for team review",
    requiredSections: ["Summary", "Motivation", "Detailed Design", "Drawbacks", "Alternatives"],
    defaultRelations: [
      { targetType: "adr", relation: "extends" },
    ],
    agentId: "rfc-agent",
    template: "rfc",
  },
  rule: {
    type: "rule",
    track: "knowledge",
    label: "Standard or Required Behavior",
    description: "Imperative statements that the team must follow",
    requiredSections: ["Rule", "Rationale", "Examples (Good/Bad)", "Enforcement"],
    defaultRelations: [
      { targetType: "adr", relation: "extends" },
      { targetType: "guide", relation: "related" },
    ],
    agentId: "rule-agent",
    template: "rule",
  },
  guide: {
    type: "guide",
    track: "knowledge",
    label: "Step-by-Step Instructions",
    description: "How-to instructions for completing a specific task",
    requiredSections: ["Prerequisites", "Steps (numbered)", "Verification", "Common Issues"],
    defaultRelations: [
      { targetType: "rule", relation: "depends_on" },
    ],
    agentId: "guide-agent",
    template: "guide",
  },
  spec: {
    type: "spec",
    track: "knowledge",
    label: "Normative Contract",
    description: "Canonical normative contract for a system, component, interface, schema, or protocol",
    requiredSections: [
      "Purpose", "Scope", "Authority", "Subject", "Contract Surface",
      "Normative Behavior", "Constraints & Invariants", "Error Handling", "Conformance",
    ],
    defaultRelations: [
      { targetType: "doc", relation: "related" },
    ],
    agentId: "spec-agent",
    template: "spec",
  },
  doc: {
    type: "doc",
    track: "knowledge",
    label: "Reference Documentation",
    description: "Non-behavioral reference material: registries, glossaries, lookup tables",
    requiredSections: ["Overview", "Content sections", "Examples"],
    defaultRelations: [],
    agentId: "doc-agent",
    template: "doc",
  },
  "task-type": {
    type: "task-type",
    track: "experience",
    label: "Recurring Task Pattern",
    description: "A proven workflow for a recurring implementation task",
    requiredSections: ["What", "When to Use", "Steps", "Example", "Things to Watch Out For"],
    defaultRelations: [
      { targetType: "rule", relation: "depends_on" },
    ],
    agentId: "task-type-agent",
    template: "task-type",
  },
  cpat: {
    type: "cpat",
    track: "experience",
    label: "Code Pattern Change",
    description: "Documents how and why a coding convention or pattern changed",
    requiredSections: ["What Changed", "Why", "Before", "After", "Scope"],
    defaultRelations: [
      { targetType: "rule", relation: "extends" },
    ],
    agentId: "cpat-agent",
    template: "cpat",
  },
};

export function getDocTypeEntry(type: DocumentType): DocTypeEntry {
  const entry = docTypeRegistry[type];
  if (!entry) {
    throw new Error(`Unknown document type: "${type}". Registered types: ${Object.keys(docTypeRegistry).join(", ")}`);
  }
  return entry;
}

export function getTypesForTrack(track: DocumentTrack): DocumentType[] {
  return Object.values(docTypeRegistry)
    .filter((e) => e.track === track)
    .map((e) => e.type);
}

export function getAgentId(type: DocumentType): string {
  return docTypeRegistry[type]?.agentId ?? `${type}-agent`;
}

export function getSuggestedRelations(docType: DocumentType): { targetType: DocumentType; relation: RelationType }[] {
  return docTypeRegistry[docType]?.defaultRelations ?? [];
}
