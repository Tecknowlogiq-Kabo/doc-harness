import type { GeneratedDocument, Score } from "../types";
import { getDocTypeEntry } from "../registry/doc-type-registry";

export function scoreDocument(document: GeneratedDocument): Score {
  const entry = getDocTypeEntry(document.type);

  const completeness = scoreCompleteness(document, entry.requiredSections);
  const format = scoreFormat(document, entry.requiredSections);
  const clarity = scoreClarity(document);
  const depth = scoreDepth(document);
  const crossRef = scoreCrossReference(document);

  const overall = (completeness * 0.25 + format * 0.2 + clarity * 0.2 + depth * 0.25 + crossRef * 0.1);

  const issues: string[] = [];
  if (completeness < 0.7) issues.push("Missing or insufficient content in required sections");
  if (format < 0.7) issues.push("Formatting or structure issues detected");
  if (clarity < 0.7) issues.push("Language clarity needs improvement");
  if (depth < 0.7) issues.push("Sections lack sufficient depth and detail");
  if (crossRef < 0.5) issues.push("Missing cross-references to related documents");

  return { completeness, format, clarity, depth, crossRef, overall, issues };
}

export function passesHardThresholds(scores: Score): boolean {
  if (scores.completeness < 0.6) return false;
  if (scores.clarity < 0.5) return false;
  if (scores.format < 0.5) return false;
  return true;
}

function scoreCompleteness(doc: GeneratedDocument, requiredSections: string[]): number {
  if (requiredSections.length === 0) return 1;

  const foundSections = requiredSections.filter((required) =>
    doc.sections.some((s) =>
      s.heading.toLowerCase().includes(required.toLowerCase())
    )
  );

  const sectionRatio = foundSections.length / requiredSections.length;

  const contentFilled = doc.sections.filter((s) => s.body.trim().length >= 50).length;
  const contentRatio = doc.sections.length > 0 ? contentFilled / doc.sections.length : 0;

  return Math.round((sectionRatio * 0.6 + contentRatio * 0.4) * 100) / 100;
}

function scoreFormat(doc: GeneratedDocument, requiredSections: string[]): number {
  let score = 1.0;

  if (!doc.title || doc.title.trim().length === 0) score -= 0.1;
  if (doc.content.length < 200) score -= 0.2;

  for (const section of doc.sections) {
    if (section.body.trim().length < 20) score -= 0.05;
    if (!section.heading || section.heading.trim().length === 0) score -= 0.05;
  }

  return Math.max(0, Math.round(score * 100) / 100);
}

function scoreClarity(doc: GeneratedDocument): number {
  const content = doc.content.toLowerCase();
  let score = 1.0;

  const vagueTerms = ["should", "might", "could", "maybe", "perhaps", "possibly", "ideally", "hopefully"];
  const vagueCount = vagueTerms.filter((t) => {
    const regex = new RegExp(`\\b${t}\\b`, "gi");
    return (content.match(regex) || []).length > 2;
  }).length;

  score -= vagueCount * 0.05;

  const preciseTerms = ["must", "shall", "will", "requires", "required"];
  const preciseCount = preciseTerms.filter((t) => {
    const regex = new RegExp(`\\b${t}\\b`, "gi");
    return (content.match(regex) || []).length > 0;
  }).length;

  score += preciseCount * 0.02;

  if (content.includes("must") || content.includes("shall")) {
    score = Math.min(1, score);
  }

  return Math.max(0, Math.round(score * 100) / 100);
}

function scoreDepth(doc: GeneratedDocument): number {
  let score = 0;

  for (const section of doc.sections) {
    const body = section.body;
    if (body.length >= 500) score += 0.25;
    else if (body.length >= 200) score += 0.2;
    else if (body.length >= 100) score += 0.15;
    else if (body.length >= 50) score += 0.1;
    else score += 0.05;
  }

  const avgScore = doc.sections.length > 0 ? score / doc.sections.length : 0;
  return Math.min(1, Math.round(avgScore * 100) / 100);
}

function scoreCrossReference(doc: GeneratedDocument): number {
  const content = doc.content.toLowerCase();
  let score = 0;

  if (content.includes("see ") || content.includes("refer to ") || content.includes("reference")) {
    score += 0.3;
  }

  if (content.includes("depends on") || content.includes("dependency") || content.includes("requires")) {
    score += 0.3;
  }

  if (content.includes("related") || content.includes("implements") || content.includes("extends")) {
    score += 0.2;
  }

  if (/\[.*\]\(.*\)/.test(doc.content)) {
    score += 0.2;
  }

  return Math.min(1, Math.round(score * 100) / 100);
}
