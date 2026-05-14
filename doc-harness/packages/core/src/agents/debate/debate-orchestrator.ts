import { advocateAgent } from "./advocate-agent";
import { skepticAgent } from "./skeptic-agent";
import { mediatorAgent } from "./mediator-agent";
import type { GeneratedDocument, DebateVerdict } from "../../types";

export interface DebateTranscript {
  docSlug: string;
  docType: string;
  rounds: {
    round: number;
    advocate: string;
    skeptic: string;
  }[];
  verdict: DebateVerdict;
}

export async function runDebate(document: GeneratedDocument): Promise<DebateTranscript> {
  const transcript: DebateTranscript = {
    docSlug: document.slug,
    docType: document.type,
    rounds: [],
    verdict: { verdict: "revise", reasoning: "", praises: [], issues: [] },
  };

  const docContext = `
Document: ${document.title}
Type: ${document.type}
Slug: ${document.slug}
Content:
${document.content}
`;

  // Round 1: Opening arguments
  const advocateR1 = await advocateAgent.generate(
    `Defend this document:\n\n${docContext}\n\nProvide your opening defense. Explain why each section is correct and complete.`
  );

  const skepticR1 = await skepticAgent.generate(
    `Critique this document:\n\n${docContext}\n\nAdvocate's defense:\n${advocateR1.text}\n\nProvide your opening critique. Identify all flaws and gaps.`
  );

  transcript.rounds.push({
    round: 1,
    advocate: advocateR1.text,
    skeptic: skepticR1.text,
  });

  // Round 2: Rebuttal and surrebuttal
  const advocateR2 = await advocateAgent.generate(
    `Respond to this critique of the document:\n\n${docContext}\n\nSkeptic's critique:\n${skepticR1.text}\n\nProvide your rebuttal. Address each point the Skeptic raised.`
  );

  const skepticR2 = await skepticAgent.generate(
    `Respond to the Advocate's rebuttal:\n\n${docContext}\n\nAdvocate's rebuttal:\n${advocateR2.text}\n\nProvide your surrebuttal. Which of the Advocate's counter-arguments fail? Why?`
  );

  transcript.rounds.push({
    round: 2,
    advocate: advocateR2.text,
    skeptic: skepticR2.text,
  });

  // Round 3: Mediator verdict
  const debateHistory = `
DOCUMENT:
${docContext}

ROUND 1:
Advocate: ${advocateR1.text}
Skeptic: ${skepticR1.text}

ROUND 2:
Advocate rebuttal: ${advocateR2.text}
Skeptic surrebuttal: ${skepticR2.text}
`;

  const verdictResult = await mediatorAgent.generate(
    `Review this debate and issue a verdict:\n\n${debateHistory}\n\nAfter reviewing all three rounds, render your final verdict (approve/revise/reject).`
  );

  const verdict: DebateVerdict = {
    verdict: verdictResult.text.toLowerCase().includes("approve") ? "approve"
      : verdictResult.text.toLowerCase().includes("reject") ? "reject"
      : "revise",
    reasoning: verdictResult.text,
    praises: extractBulletPoints(verdictResult.text, /praise|strength|good|well/i),
    issues: extractBulletPoints(verdictResult.text, /issue|flaw|missing|vague|weak|error/i),
    suggestedFixes: verdictResult.text.toLowerCase().includes("revise")
      ? extractBulletPoints(verdictResult.text, /fix|suggest|recommend|should/i)
      : undefined,
  };

  transcript.verdict = verdict;
  return transcript;
}

function extractBulletPoints(text: string, relevanceRegex: RegExp): string[] {
  const lines = text.split("\n");
  const bullets: string[] = [];

  let inRelevantSection = false;
  for (const line of lines) {
    if (relevanceRegex.test(line)) {
      inRelevantSection = true;
    }
    if (inRelevantSection && (line.trim().startsWith("-") || line.trim().startsWith("*") || /^\d+\./.test(line.trim()))) {
      bullets.push(line.replace(/^[-*\d.]\s*/, "").trim());
    }
  }

  return bullets.length > 0 ? bullets : ["Review the full verdict for details"];
}
