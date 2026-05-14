export interface Section {
  heading: string;
  body: string;
}

export function extractSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split("\n");
  let currentHeading = "Overview";
  let currentBody: string[] = [];
  let foundFirstHeading = false;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (foundFirstHeading || currentBody.length > 0) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join("\n").trim(),
        });
      }
      currentHeading = headingMatch[1].trim();
      currentBody = [];
      foundFirstHeading = true;
    } else {
      currentBody.push(line);
    }
  }

  if (currentBody.length > 0 || foundFirstHeading) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join("\n").trim(),
    });
  }

  if (sections.length === 0) {
    sections.push({
      heading: "Overview",
      body: markdown.trim(),
    });
  }

  return sections;
}
