// M8-S11: Globaler Dice-Link-Layer (EPIC-013)
// Detects dice notation (XdY, XdY+Z, XdY-Z) in rendered text and turns it into
// clickable spans. Active only in Play mode — never inside editors/input fields.

export interface DiceMatch {
  expression: string;
  start: number;
  end: number;
}

export interface DiceLinkOptions {
  /** 'editor' contexts (input fields, rich-text editors) are never linked. */
  context?: 'display' | 'editor';
  /** Dice links render only in Play mode; false disables wrapping. */
  playMode?: boolean;
}

// XdY with optional +Z / -Z modifier, case-insensitive.
const DICE_PATTERN = /\b(\d+)[dD](\d+)([+-]\d+)?\b/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isLinkable(options?: DiceLinkOptions): boolean {
  if (options?.context === 'editor') return false;
  if (options?.playMode === false) return false;
  return true;
}

export function parseDiceExpressions(text: string, options?: DiceLinkOptions): DiceMatch[] {
  if (!isLinkable(options)) return [];
  const matches: DiceMatch[] = [];
  for (const match of text.matchAll(DICE_PATTERN)) {
    const start = match.index ?? 0;
    matches.push({ expression: match[0], start, end: start + match[0].length });
  }
  return matches;
}

/**
 * Render text to HTML with dice expressions wrapped in clickable spans. All
 * surrounding user text is HTML-escaped first (AP-004). In editor context or
 * outside Play mode the text is escaped but never linked.
 */
export function renderDiceLinks(text: string, options?: DiceLinkOptions): string {
  if (!isLinkable(options)) return escapeHtml(text);
  const matches = parseDiceExpressions(text, options);
  let html = '';
  let cursor = 0;
  for (const match of matches) {
    html += escapeHtml(text.slice(cursor, match.start));
    const expr = escapeHtml(match.expression);
    html += `<span class="dice-link" role="button" tabindex="0" data-dice-expression="${expr}">${expr}</span>`;
    cursor = match.end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}
