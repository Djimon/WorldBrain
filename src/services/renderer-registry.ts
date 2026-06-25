type RendererComponent = (...args: unknown[]) => unknown;

const _renderers: Map<string, RendererComponent> = new Map();

const STUB = () => null;

const CORE_RENDERERS = [
  'core.text_input', 'core.text_area', 'core.rich_text', 'core.number_input',
  'core.boolean_toggle', 'core.select', 'core.multi_select', 'core.date_time_picker',
  'core.entity_picker', 'core.relation_picker', 'core.repeater', 'core.condition_builder',
  'core.file_asset_picker', 'core.map_coordinate_picker', 'core.dice_expression_input',
  'core.markdown_preview',
  'core.entity_embed', 'core.secret_block', 'core.map_marker_editor',
  'core.timeline_event_editor', 'core.card_preview', 'core.statblock_editor',
  'core.rule_reference_block', 'core.capture_inbox_item',
];

for (const name of CORE_RENDERERS) {
  _renderers.set(name, STUB);
}

export function registerRenderer(name: string, component: RendererComponent): void {
  _renderers.set(name, component);
}

export function getRenderer(name: string): RendererComponent | undefined {
  return _renderers.get(name);
}

export function listRenderers(): string[] {
  return [..._renderers.keys()];
}
