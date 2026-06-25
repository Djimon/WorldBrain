import { resolveVisibility } from './visibility-service';

interface ExportField {
  key: string;
  value: unknown;
  visibility?: string;
  entity_id?: string;
  condition?: unknown;
}

interface ExportContext {
  role: 'gm' | 'player';
  knownEntities: string[];
  sessionVars: Record<string, unknown>;
  globalVars: Record<string, unknown>;
}

export function projectFieldsForExport(fields: ExportField[], ctx: ExportContext): ExportField[] {
  const audience = ctx.role === 'gm' ? 'gm' : 'player';
  const knownSet = new Set(ctx.knownEntities);

  return fields.filter((field) => {
    const vis = field.visibility ?? 'public';
    const result = resolveVisibility(
      { visibility: vis, entityId: field.entity_id, condition: field.condition },
      {
        audience,
        knownEntities: knownSet,
        vars: ctx.sessionVars,
        globals: ctx.globalVars,
      },
    );
    return result !== 'hidden';
  });
}
