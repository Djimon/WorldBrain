import { BUILT_IN_CARD_TEMPLATES, type CardTemplate } from '../../core_data/card-schema';

const _cardTemplates: Map<string, CardTemplate> = new Map(
  BUILT_IN_CARD_TEMPLATES.map((t) => [t.id, t]),
);
const _icons: Map<string, string> = new Map();
const _colorTokens: Map<string, string> = new Map();

export function registerPluginCardTemplate(template: CardTemplate): void {
  if (_cardTemplates.has(template.id)) {
    console.warn(`Plugin card template conflict: "${template.id}" already registered. Second definition wins.`);
  }
  _cardTemplates.set(template.id, template);
}

export function listCardTemplates(): CardTemplate[] {
  return [..._cardTemplates.values()];
}

export function listCardTemplatesForEntityType(entityType: string): CardTemplate[] {
  return [..._cardTemplates.values()].filter((t) => t.entity_types.includes(entityType));
}

export function registerPluginIcon(name: string, svgContent: string): void {
  _icons.set(name, svgContent);
}

export function getIcon(name: string): string | undefined {
  return _icons.get(name);
}

export function registerPluginColorTokens(tokens: Record<string, string>): void {
  for (const [key, value] of Object.entries(tokens)) {
    _colorTokens.set(key, value);
  }
}

export function getColorToken(name: string): string | undefined {
  return _colorTokens.get(name);
}
