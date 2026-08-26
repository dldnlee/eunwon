/**
 * Minimal block parser for the AI-generated 사업계획서 markdown (## headings, paragraphs,
 * `-`/`*` bullet lists). Shared by the .docx and .hwpx renderers, which both need the same
 * heading/paragraph/bullet structure rather than raw markdown syntax.
 */
export type PlanBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string };

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function parseBusinessPlanMarkdown(markdown: string): PlanBlock[] {
  const blocks: PlanBlock[] = [];
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    const text = stripInlineMarkdown(buffer.join(' '));
    if (text) blocks.push({ type: 'paragraph', text });
    buffer = [];
  };

  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const text = stripInlineMarkdown(headingMatch[1]);
      if (text) blocks.push({ type: 'heading', text });
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      const text = stripInlineMarkdown(bulletMatch[1]);
      if (text) blocks.push({ type: 'bullet', text });
      continue;
    }

    buffer.push(line);
  }
  flushParagraph();

  return blocks;
}
