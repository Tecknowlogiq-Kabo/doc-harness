import { describe, it, expect } from "vitest";
import { mapRelations } from "../pipeline/pipeline-orchestrator";
import type { GeneratedDocument } from "../types";

describe("mapRelations", () => {
  it("creates relations between related document types", () => {
    const docs: GeneratedDocument[] = [
      {
        slug: "test-prd",
        type: "prd",
        title: "PRD",
        content: "# PRD\n\nContent",
        sections: [{ heading: "Overview", body: "Content here" }],
      },
      {
        slug: "test-plan",
        type: "plan",
        title: "Plan",
        content: "# Plan\n\nContent",
        sections: [{ heading: "Overview", body: "Content here" }],
      },
    ];

    const relations = mapRelations(docs);
    expect(relations.length).toBeGreaterThan(0);
    expect(relations.some((r) => r.source === "test-prd" && r.target === "test-plan")).toBe(true);
  });

  it("returns empty array for single document with no relations", () => {
    const docs: GeneratedDocument[] = [
      {
        slug: "solo",
        type: "doc",
        title: "Solo Doc",
        content: "# Doc\n\nContent",
        sections: [{ heading: "Overview", body: "Content" }],
      },
    ];

    const relations = mapRelations(docs);
    expect(relations).toEqual([]);
  });

  it("does not create duplicate relations", () => {
    const docs: GeneratedDocument[] = [
      {
        slug: "prd-1",
        type: "prd",
        title: "PRD",
        content: "content",
        sections: [],
      },
      {
        slug: "plan-1",
        type: "plan",
        title: "Plan",
        content: "content",
        sections: [],
      },
    ];

    const relations = mapRelations(docs);
    const prdToPlan = relations.filter((r) => r.source === "prd-1" && r.target === "plan-1");
    expect(prdToPlan.length).toBeLessThanOrEqual(1);
  });
});
