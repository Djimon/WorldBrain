import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface Creature {
  id: string;
  name: string;
  type: string;
  ac: number;
  hp_expression: string;
  speed: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  saving_throws?: string[];
  skills?: string[];
  immunities?: string[];
  resistances?: string[];
  senses?: string;
  languages?: string[];
  cr: string;
  xp: number;
  traits?: string;
  actions?: string;
  legendary_actions?: string;
  mythic_actions?: string;
  lair_actions?: string;
  special?: string;
  description?: string;
}

interface CreatureStatBlockProps {
  creature: Creature;
  inPlayMode: boolean;
  sessionId?: string;
}

// Standard ability-score notation (system-agnostic identifiers, not UI prose).
const ABILITIES: { id: keyof Creature; label: string }[] = [
  { id: 'str', label: 'STR' },
  { id: 'dex', label: 'DEX' },
  { id: 'con', label: 'CON' },
  { id: 'int', label: 'INT' },
  { id: 'wis', label: 'WIS' },
  { id: 'cha', label: 'CHA' },
];

export function CreatureStatBlock({ creature, inPlayMode }: CreatureStatBlockProps) {
  const { t } = useTranslation('session');
  const [currentHp, setCurrentHp] = useState<number>(0);

  return (
    <div className="stat-block">
      <h3 className="stat-block__name">{creature.name}</h3>
      <p className="stat-block__meta">
        {creature.type} · {t('statBlock.cr', 'HG')} {creature.cr} · {creature.xp} {t('statBlock.xp', 'XP')}
      </p>

      <div className="stat-block__defenses">
        <div>{t('statBlock.ac', 'Rüstungsklasse')}: {creature.ac}</div>
        <div>{t('statBlock.hp', 'Trefferpunkte')}: {creature.hp_expression}</div>
        <div>{t('statBlock.speed', 'Bewegung')}: {creature.speed}</div>
      </div>

      <div className="stat-block__abilities">
        {ABILITIES.map((a) => (
          <span key={a.id} className="stat-block__ability">
            {a.label} {String(creature[a.id])}
          </span>
        ))}
      </div>

      {creature.saving_throws && creature.saving_throws.length > 0 && (
        <div>{t('statBlock.saves', 'Rettungswürfe')}: {creature.saving_throws.join(', ')}</div>
      )}
      {creature.skills && creature.skills.length > 0 && (
        <div>{t('statBlock.skills', 'Fertigkeiten')}: {creature.skills.join(', ')}</div>
      )}
      {creature.senses && <div>{t('statBlock.senses', 'Sinne')}: {creature.senses}</div>}

      {inPlayMode && (
        <div className="stat-block__hp-tracker">
          <label>
            {t('statBlock.currentHp', 'Aktuelle HP')}
            <input
              type="number"
              aria-label={t('statBlock.currentHp', 'Aktuelle HP')}
              value={currentHp}
              onChange={(e) => setCurrentHp(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {creature.traits && (
        <section>
          <h4>{t('statBlock.traits', 'Merkmale')}</h4>
          <p>{creature.traits}</p>
        </section>
      )}
      {creature.actions && (
        <section>
          <h4>{t('statBlock.actions', 'Aktionen')}</h4>
          <p>{creature.actions}</p>
        </section>
      )}
      {creature.legendary_actions && (
        <section>
          <h4>{t('statBlock.legendaryActions', 'Legendäre Aktionen')}</h4>
          <p>{creature.legendary_actions}</p>
        </section>
      )}
      {creature.lair_actions && (
        <section>
          <h4>{t('statBlock.lairActions', 'Hort-Aktionen')}</h4>
          <p>{creature.lair_actions}</p>
        </section>
      )}
      {creature.special && (
        <section>
          <h4>{t('statBlock.special', 'Besonderes')}</h4>
          <p>{creature.special}</p>
        </section>
      )}
      {creature.description && <p className="stat-block__description">{creature.description}</p>}
    </div>
  );
}
