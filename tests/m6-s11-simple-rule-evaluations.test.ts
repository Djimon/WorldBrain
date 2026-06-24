// @vitest-environment node
// M6-S11: Simple rule evaluations — Mystery Breaker Detector, Role Coverage, Quest Dependency Blocker.
// See: https://github.com/Djimon/WorldBrain/issues/101

import { describe, expect, it } from 'vitest';

async function getEvaluations() { return import('../src/services/rule-evaluations'); }

// --- Mystery Breaker Detector ---
const questWithFragile = { id: 'q1', title: 'The Locked Tomb', fragile_to: ['mystery_breaker', 'corpse_interrogation'] };
const partyWithSpeakWithDead = [
  { id: 'char-ada', class_features: ['Speak with Dead'], capability_tags: ['corpse_interrogation'] },
  { id: 'char-bob', class_features: ['Fireball'], capability_tags: [] },
];
const partyWithoutBreaker = [
  { id: 'char-bob', class_features: ['Fireball'], capability_tags: [] },
];

// --- Role Coverage ---
const partyRoles = [
  { id: 'char-ada', role_tags: ['healer', 'utility'] },
  { id: 'char-bob', role_tags: ['frontline', 'AoE'] },
];

// --- Quest Dependency Blocker ---
const questGraph = {
  quest: { id: 'q1', requires_clue: 'clue-key' },
  clues: [{ id: 'clue-key', in_location: 'loc-vault', requires_npc: 'npc-keeper' }],
  npcs: [{ id: 'npc-keeper', is_dead: true, location: 'loc-vault' }],
};

describe('M6-S11 simple rule evaluations', () => {
  describe('Mystery Breaker Detector', () => {
    it('exports detectMysteryBreakers function', async () => {
      const mod = await getEvaluations();
      expect(typeof mod.detectMysteryBreakers).toBe('function');
    });

    it('detects party member with capability matching fragile_to', async () => {
      const { detectMysteryBreakers } = await getEvaluations();
      const result = detectMysteryBreakers({ quest: questWithFragile, party: partyWithSpeakWithDead });
      expect(result.hasBreaker).toBe(true);
      expect(result.matchingAbilities.length).toBeGreaterThan(0);
    });

    it('no warning when party lacks fragile capabilities', async () => {
      const { detectMysteryBreakers } = await getEvaluations();
      const result = detectMysteryBreakers({ quest: questWithFragile, party: partyWithoutBreaker });
      expect(result.hasBreaker).toBe(false);
    });

    it('result includes suggested mitigations array', async () => {
      const { detectMysteryBreakers } = await getEvaluations();
      const result = detectMysteryBreakers({ quest: questWithFragile, party: partyWithSpeakWithDead });
      expect(Array.isArray(result.mitigations)).toBe(true);
    });
  });

  describe('Role Coverage', () => {
    it('exports analyzeRoleCoverage function', async () => {
      const mod = await getEvaluations();
      expect(typeof mod.analyzeRoleCoverage).toBe('function');
    });

    it('covered roles are identified from party role_tags', async () => {
      const { analyzeRoleCoverage } = await getEvaluations();
      const result = analyzeRoleCoverage({ party: partyRoles });
      expect(result.covered).toContain('healer');
      expect(result.covered).toContain('frontline');
    });

    it('uncovered roles are listed', async () => {
      const { analyzeRoleCoverage } = await getEvaluations();
      const result = analyzeRoleCoverage({ party: partyRoles });
      expect(result.uncovered).toContain('scout');
    });

    it('each covered role has party members listed', async () => {
      const { analyzeRoleCoverage } = await getEvaluations();
      const result = analyzeRoleCoverage({ party: partyRoles });
      expect(result.coverageMap['healer']).toContain('char-ada');
    });
  });

  describe('Quest Dependency Blocker', () => {
    it('exports detectQuestBlockers function', async () => {
      const mod = await getEvaluations();
      expect(typeof mod.detectQuestBlockers).toBe('function');
    });

    it('detects blocked dependency chain when required NPC is dead', async () => {
      const { detectQuestBlockers } = await getEvaluations();
      const result = detectQuestBlockers({ questId: 'q1', graph: questGraph });
      expect(result.isBlocked).toBe(true);
    });

    it('blocked path identifies the blocking condition', async () => {
      const { detectQuestBlockers } = await getEvaluations();
      const result = detectQuestBlockers({ questId: 'q1', graph: questGraph });
      expect(result.blockedPaths.length).toBeGreaterThan(0);
      expect(result.blockedPaths[0].blockingCondition).toMatch(/dead|npc-keeper/i);
    });

    it('no blockers when dependency chain is intact', async () => {
      const { detectQuestBlockers } = await getEvaluations();
      const intactGraph = {
        ...questGraph,
        npcs: [{ id: 'npc-keeper', is_dead: false, location: 'loc-vault' }],
      };
      const result = detectQuestBlockers({ questId: 'q1', graph: intactGraph });
      expect(result.isBlocked).toBe(false);
    });
  });
});
