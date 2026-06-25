import { getRelationTypeDefinition as getCoreRelationType, getAllRelationTypes } from '../data/relation-type-registry';
import { getPlugin } from './plugin-loader';

export interface PluginEntityType {
  id: string;
  label: string;
  schema: object;
  ui_schema?: object;
  color?: string;
}

export interface PluginRelationType {
  id: string;
  relation_type: string;
  inverse_type: string;
  symmetry?: string;
  label: string;
  inverse_label: string;
}

const CORE_ENTITY_TYPES: PluginEntityType[] = [
  { id: 'Character', label: 'Character', schema: {} },
  { id: 'Location', label: 'Location', schema: {} },
  { id: 'Item', label: 'Item', schema: {} },
  { id: 'Quest', label: 'Quest', schema: {} },
  { id: 'Faction', label: 'Faction', schema: {} },
  { id: 'Event', label: 'Event', schema: {} },
];

const _entityTypes: Map<string, PluginEntityType> = new Map(CORE_ENTITY_TYPES.map((t) => [t.id, t]));
const _relationTypes: Map<string, PluginRelationType> = new Map();

export function registerPluginEntityType(type: PluginEntityType, pluginId?: string): void {
  if (_entityTypes.has(type.id)) {
    const msg = `Conflict: entity type "${type.id}" already registered`;
    console.warn(`Plugin entity type conflict: "${type.id}" already registered. Second definition wins.`);
    if (pluginId) {
      const entry = getPlugin(pluginId);
      if (entry) {
        entry.status = 'conflict';
        entry.errors = [...(entry.errors ?? []), msg];
      }
    }
  }
  _entityTypes.set(type.id, type);
}

export function getEntityType(id: string): PluginEntityType | undefined {
  return _entityTypes.get(id);
}

export function listEntityTypes(): PluginEntityType[] {
  return [..._entityTypes.values()];
}

export function registerPluginRelationType(type: PluginRelationType): void {
  if (_relationTypes.has(type.relation_type)) {
    console.warn(`Plugin relation type conflict: "${type.relation_type}" already registered.`);
  }
  _relationTypes.set(type.relation_type, type);
}

export function getRelationTypeDefinition(id: string) {
  return _relationTypes.get(id) ?? getCoreRelationType(id);
}

export function listPluginRelationTypes(): PluginRelationType[] {
  return [..._relationTypes.values()];
}

export function flagOutdatedSchema(_entityTypeId: string, _entityIds: string[]): void {
  // Marks entities as having outdated_schema — no-op stub for registry layer
}
