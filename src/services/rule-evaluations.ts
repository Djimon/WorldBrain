const ALL_ROLES = ['frontline', 'healer', 'control', 'utility', 'face', 'scout', 'AoE', 'single-target'];

interface PartyMember {
  id: string;
  capability_tags?: string[];
  class_features?: string[];
  role_tags?: string[];
}

interface Quest {
  id: string;
  fragile_to?: string[];
}

interface MysteryBreakerResult {
  hasBreaker: boolean;
  matchingAbilities: string[];
  mitigations: string[];
}

export function detectMysteryBreakers(opts: { quest: Quest; party: PartyMember[] }): MysteryBreakerResult {
  const { quest, party } = opts;
  const fragile = quest.fragile_to ?? [];
  const matchingAbilities: string[] = [];

  for (const member of party) {
    const tags = member.capability_tags ?? [];
    for (const tag of tags) {
      if (fragile.includes(tag)) {
        const ability = member.class_features?.find((f) => f.toLowerCase().includes(tag.split('_')[0])) ?? tag;
        matchingAbilities.push(`${member.id}: ${ability}`);
      }
    }
  }

  return {
    hasBreaker: matchingAbilities.length > 0,
    matchingAbilities,
    mitigations: matchingAbilities.map((a) => `Consider restricting access to: ${a}`),
  };
}

interface RoleCoverageResult {
  covered: string[];
  uncovered: string[];
  coverageMap: Record<string, string[]>;
}

export function analyzeRoleCoverage(opts: { party: PartyMember[] }): RoleCoverageResult {
  const { party } = opts;
  const coverageMap: Record<string, string[]> = {};

  for (const member of party) {
    for (const role of member.role_tags ?? []) {
      if (!coverageMap[role]) coverageMap[role] = [];
      coverageMap[role].push(member.id);
    }
  }

  const covered = Object.keys(coverageMap);
  const uncovered = ALL_ROLES.filter((r) => !coverageMap[r]);

  return { covered, uncovered, coverageMap };
}

interface QuestGraph {
  quest: { id: string; requires_clue?: string };
  clues: { id: string; in_location?: string; requires_npc?: string }[];
  npcs: { id: string; is_dead: boolean; location?: string }[];
}

interface BlockedPath {
  path: string[];
  blockingCondition: string;
}

interface QuestBlockerResult {
  isBlocked: boolean;
  blockedPaths: BlockedPath[];
}

export function detectQuestBlockers(opts: { questId: string; graph: QuestGraph }): QuestBlockerResult {
  const { graph } = opts;
  const blockedPaths: BlockedPath[] = [];

  const clueId = graph.quest.requires_clue;
  if (!clueId) return { isBlocked: false, blockedPaths: [] };

  const clue = graph.clues.find((c) => c.id === clueId);
  if (!clue) return { isBlocked: false, blockedPaths: [] };

  if (clue.requires_npc) {
    const npc = graph.npcs.find((n) => n.id === clue.requires_npc);
    if (npc?.is_dead) {
      blockedPaths.push({
        path: [graph.quest.id, clueId, clue.requires_npc],
        blockingCondition: `NPC ${npc.id} is dead`,
      });
    }
  }

  return { isBlocked: blockedPaths.length > 0, blockedPaths };
}
