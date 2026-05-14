import { describe, it, expect } from "vitest";
import { documentToMarkdown } from "../export/markdown-writer";
import type { GeneratedDocument } from "../types";

describe("documentToMarkdown", () => {
  it("produces markdown with title, metadata, and content", () => {
    const doc: GeneratedDocument = {
      slug: "test-doc",
      type: "prd",
      title: "Test Document",
      content: "## Section 1\n\nHello world",
      sections: [{ heading: "Section 1", body: "Hello world" }],
    };

    const result = documentToMarkdown(doc);
    expect(result).toContain("# Test Document");
    expect(result).toContain("**Type:** prd");
    expect(result).toContain("**Slug:** test-doc");
    expect(result).toContain("## Section 1");
    expect(result).toContain("Hello world");
  });

  it("includes slug in metadata line", () => {
    const doc: GeneratedDocument = {
      slug: "my-slug",
      type: "adr",
      title: "ADR",
      content: "content",
      sections: [],
    };

    const result = documentToMarkdown(doc);
    expect(result).toContain("**Slug:** my-slug");
  });

  it("handles empty content", () => {
    const doc: GeneratedDocument = {
      slug: "empty",
      type: "doc",
      title: "Empty Doc",
      content: "",
      sections: [],
    };

    const result = documentToMarkdown(doc);
    expect(result).toContain("# Empty Doc");
  });
});
