// M8-S06: Session-Log Markdown-Export (EPIC-013)
// Groups log entries by world-time section and renders a recap in Markdown.

export interface SessionLogEntry {
  id: string;
  session_id: string;
  real_timestamp: string;
  world_datetime: string;
  round: number | null;
  action_type: string;
  description: string;
  entity_id: string | null;
}

export interface ExportOptions {
  entries: SessionLogEntry[];
  startWorldDatetime?: string;
  endWorldDatetime?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRealTime(iso: string): string {
  // "2026-01-10T20:05:00Z" → "20:05"
  return iso.length >= 16 ? iso.slice(11, 16) : iso;
}

/**
 * Render the session log as Markdown. Entries are grouped under a heading per
 * world-time section; each line is `[Weltzeit] Reale Zeit — Beschreibung`.
 * World-time strings are compared lexically for the optional date-range filter
 * (they share a fixed calendar format).
 */
export function exportSessionLogToMarkdown(options: ExportOptions): string {
  const { entries, startWorldDatetime, endWorldDatetime } = options;

  const filtered = entries.filter((entry) => {
    if (startWorldDatetime && entry.world_datetime < startWorldDatetime) return false;
    if (endWorldDatetime && entry.world_datetime > endWorldDatetime) return false;
    return true;
  });

  const sections: string[] = [];
  let currentSection: string | null = null;

  for (const entry of filtered) {
    if (entry.world_datetime !== currentSection) {
      currentSection = entry.world_datetime;
      sections.push(`\n## ${escapeHtml(entry.world_datetime)}\n`);
    }
    const round = entry.round != null ? ` (Runde ${entry.round})` : '';
    sections.push(
      `- [${escapeHtml(entry.world_datetime)}] ${formatRealTime(entry.real_timestamp)} — ${escapeHtml(entry.description)}${round}`,
    );
  }

  return `# Session-Log\n${sections.join('\n')}\n`;
}
