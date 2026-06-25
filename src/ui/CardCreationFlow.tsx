import { useState } from 'react';
import { listCardTemplates, createCardInstance } from '../services/card-service';
import { listEntitiesByType } from '../services/entity-service';
import type { DatabaseLike } from '../services/entity-service';

interface Props {
  database: DatabaseLike;
  onComplete: (cardId: string) => void;
}

export function CardCreationFlow({ database, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; type: string; title: string } | null>(null);

  const entities = listEntitiesByType({ database, type: null }) as Array<{ id: string; type: string; title: string; summary: string }>;
  const allTemplates = listCardTemplates(database);

  const filteredTemplates = selectedEntity
    ? allTemplates.filter((t) => {
        const types = JSON.parse(t.entity_types) as string[];
        return types.includes(selectedEntity.type);
      })
    : allTemplates;

  function handleEntityClick(entity: { id: string; type: string; title: string }) {
    setSelectedEntity(entity);
    setStep(2);
  }

  function handleTemplateClick(templateId: string) {
    if (!selectedEntity) return;
    const result = createCardInstance(database, { entityId: selectedEntity.id, templateId });
    onComplete(result.id);
  }

  if (step === 1) {
    return (
      <div>
        <label>Choose an entity</label>
        {entities.map((e) => (
          <div key={e.id} onClick={() => handleEntityClick(e)} style={{ cursor: 'pointer' }}>
            {e.title}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div>Choose card style for {selectedEntity?.title}</div>
      {filteredTemplates.map((t) => (
        <div key={t.id} onClick={() => handleTemplateClick(t.id)} style={{ cursor: 'pointer' }}>
          {t.label}
        </div>
      ))}
    </div>
  );
}
