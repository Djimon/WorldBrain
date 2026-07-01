import { marked } from 'marked';

/** Render markdown to HTML (caller must sanitize with DOMPurify before injection). */
export function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false }) as string;
}

/** Strip markdown syntax for plain-text previews (list items, search results, etc.).
 *  Regex-only — avoids a full parse round-trip per row. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // links → label
    .replace(/`{1,3}[^`]*`{1,3}/g, '')        // inline code
    .replace(/^```[\s\S]*?```$/gm, '')         // fenced blocks
    .replace(/(\*\*|__)(.*?)\1/g, '$2')        // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')           // italic
    .replace(/~~(.*?)~~/g, '$1')               // strikethrough
    .replace(/^#{1,6}\s+/gm, '')               // ATX headings
    .replace(/^[-*+]\s+/gm, '')                // unordered list markers
    .replace(/^\d+\.\s+/gm, '')                // ordered list markers
    .replace(/^>\s*/gm, '')                    // blockquotes
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
