import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addLogEntry } from '../services/session-log-service';
import type { DatabaseLike } from '../services/entity-service';

export interface PluginCharacterField {
  id: string;
  label: string;
  type: string;
  section: string;
  editable_in_play?: boolean;
}

export interface CharacterSystemPlugin {
  id: string;
  playerCharacterFields: PluginCharacterField[];
}

export interface PlayerCharacter {
  id: string;
  name: string;
  is_player_character?: boolean;
  player_name?: string;
  note?: string;
  [key: string]: unknown;
}

interface PlayerCharacterSheetProps {
  database: DatabaseLike;
  character: PlayerCharacter;
  systemPlugin: CharacterSystemPlugin | null;
  sessionId: string;
  inPlayMode: boolean;
}

// German default labels for known field sections (i18n keys resolve these).
const SECTION_DEFAULTS: Record<string, string> = {
  attributes: 'Attribute',
  resources: 'Ressourcen',
};

export function PlayerCharacterSheet({
  database,
  character,
  systemPlugin,
  sessionId,
  inPlayMode,
}: PlayerCharacterSheetProps) {
  const { t } = useTranslation('session');
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const field of systemPlugin?.playerCharacterFields ?? []) {
      if (typeof character[field.id] === 'number') init[field.id] = character[field.id] as number;
    }
    return init;
  });

  function handleFieldBlur(field: PluginCharacterField): void {
    if (values[field.id] === character[field.id]) return;
    void addLogEntry(database, {
      session_id: sessionId,
      real_timestamp: new Date().toISOString(),
      world_datetime: '',
      round: null,
      action_type: 'character_update',
      description: `${character.name}: ${field.label} → ${values[field.id]}`,
      entity_id: character.id,
    });
  }

  const sections = [...new Set((systemPlugin?.playerCharacterFields ?? []).map((f) => f.section))];

  return (
    <div className="character-sheet">
      <h3 className="character-sheet__name">{character.name}</h3>
      <div className="character-sheet__base">
        <div>
          {t('character.player', 'Spieler')}: {character.player_name}
        </div>
        <div>
          {t('character.note', 'Freinotiz')}: {character.note}
        </div>
      </div>

      {sections.map((section) => (
        <section key={section} className="character-sheet__section">
          <h4>{t(`character.section.${section}`, SECTION_DEFAULTS[section] ?? section)}</h4>
          {(systemPlugin?.playerCharacterFields ?? [])
            .filter((f) => f.section === section)
            .map((field) => {
              const editable = inPlayMode && field.editable_in_play === true;
              return (
                <div key={field.id} className="character-sheet__field">
                  <label>
                    {field.label}
                    {editable ? (
                      <input
                        type="number"
                        aria-label={field.label}
                        value={values[field.id] ?? 0}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [field.id]: Number(e.target.value) }))
                        }
                        onBlur={() => handleFieldBlur(field)}
                      />
                    ) : (
                      <span> {String(character[field.id] ?? '')}</span>
                    )}
                  </label>
                </div>
              );
            })}
        </section>
      ))}
    </div>
  );
}
