/** Strip markdown syntax for plain-text previews (list items, search results, etc.) */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')       // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/__(.+?)__/g, '$1')       // bold alt
    .replace(/_(.+?)_/g, '$1')         // italic alt
    .replace(/~~(.+?)~~/g, '$1')       // strikethrough
    .replace(/`(.+?)`/g, '$1')         // inline code
    .replace(/^\s*[-*+]\s+/gm, '')     // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')     // ordered list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/\n+/g, ' ')              // newlines → space
    .trim();
}
