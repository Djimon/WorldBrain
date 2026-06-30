import { marked } from 'marked';

/** Strip markdown syntax for plain-text previews (list items, search results, etc.) */
export function stripMarkdown(text: string): string {
  const html = marked.parse(text, { async: false }) as string;
  return html
    .replace(/<[^>]+>/g, ' ')   // strip all HTML tags
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/(?:^|\s)#{2,6}(?=\s|$)/g, ' ') // stray hash-runs left from malformed/inline headings
    .replace(/\s+/g, ' ')
    .trim();
}
