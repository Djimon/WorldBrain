import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session } from '../services/session-service';

interface PlayModeScreenProps {
  session: Session;
  projectDir: string;
  onSwitchToCreate: () => void;
}

interface ToolDef {
  id: string;
  labelKey: string;
  labelDefault: string;
}

// Left-sidebar tool launchers (EPIC-013 M8-S03, decision 5).
const SIDEBAR_TOOLS: ToolDef[] = [
  { id: 'encounter', labelKey: 'playMode.tool.encounter', labelDefault: 'Encounter-Liste' },
  { id: 'character', labelKey: 'playMode.tool.character', labelDefault: 'Character-Panel' },
  { id: 'entity-notes', labelKey: 'playMode.tool.entityNotes', labelDefault: 'Entity-Notizen' },
  { id: 'session-log', labelKey: 'playMode.tool.sessionLog', labelDefault: 'Session-Log' },
  { id: 'calendar', labelKey: 'playMode.tool.calendar', labelDefault: 'Kalender / Zeit' },
  { id: 'dice', labelKey: 'playMode.tool.dice', labelDefault: 'Würfelpanel' },
  { id: 'rules', labelKey: 'playMode.tool.rules', labelDefault: 'Regeln (DM Screen)' },
];

// Widget types available on the GM whiteboard (Tab 1).
const WIDGET_TYPES: { id: string; labelKey: string; labelDefault: string }[] = [
  { id: 'counter', labelKey: 'playMode.widget.counter', labelDefault: 'Counter' },
  { id: 'variables', labelKey: 'playMode.widget.variables', labelDefault: 'Session-Variablen' },
  { id: 'encounter-info', labelKey: 'playMode.widget.encounterInfo', labelDefault: 'Aktive Encounter-Info' },
  { id: 'note', labelKey: 'playMode.widget.note', labelDefault: 'Notizfeld' },
  { id: 'entity-shortcut', labelKey: 'playMode.widget.entityShortcut', labelDefault: 'Entity-Schnellzugriff' },
];

interface Widget {
  key: string;
  label: string;
}

const STATIC_WHITEBOARD = 'whiteboard';
const STATIC_MAP = 'map';

export function PlayModeScreen({ session, onSwitchToCreate }: PlayModeScreenProps) {
  const { t } = useTranslation('session');
  const [activeTab, setActiveTab] = useState<string>(STATIC_WHITEBOARD);
  const [openTools, setOpenTools] = useState<ToolDef[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [widgetType, setWidgetType] = useState<string>(WIDGET_TYPES[0].id);

  function openTool(tool: ToolDef): void {
    setOpenTools((prev) => (prev.some((tab) => tab.id === tool.id) ? prev : [...prev, tool]));
    setActiveTab(tool.id);
  }

  function closeTool(id: string): void {
    setOpenTools((prev) => prev.filter((tab) => tab.id !== id));
    setActiveTab(STATIC_WHITEBOARD);
  }

  function addWidget(): void {
    const type = WIDGET_TYPES.find((w) => w.id === widgetType);
    if (!type) return;
    const label = t(type.labelKey, type.labelDefault);
    setWidgets((prev) => [...prev, { key: `${type.id}-${prev.length}`, label }]);
  }

  function removeWidget(key: string): void {
    setWidgets((prev) => prev.filter((w) => w.key !== key));
  }

  const closeLabel = t('playMode.close', 'schließen');
  const removeLabel = t('playMode.remove', 'entfernen');

  return (
    <div className="play-mode">
      <header className="play-mode__header">
        <span className="play-mode__title">{session.title}</span>
        <button className="btn" onClick={onSwitchToCreate}>
          {t('playMode.switchToCreate', 'Zu Create-Modus wechseln')}
        </button>
      </header>

      <div className="play-mode__body">
        <nav className="play-mode__sidebar" aria-label={t('playMode.tools', 'Werkzeuge')}>
          {SIDEBAR_TOOLS.map((tool) => (
            <button key={tool.id} className="btn play-mode__tool" onClick={() => openTool(tool)}>
              {t(tool.labelKey, tool.labelDefault)}
            </button>
          ))}
        </nav>

        <div className="play-mode__main">
          <div className="play-mode__tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === STATIC_WHITEBOARD}
              onClick={() => setActiveTab(STATIC_WHITEBOARD)}
            >
              {t('playMode.tabWhiteboard', 'Whiteboard')}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === STATIC_MAP}
              onClick={() => setActiveTab(STATIC_MAP)}
            >
              {t('playMode.tabMap', 'Karte')}
            </button>
            {openTools.map((tool) => {
              const label = t(tool.labelKey, tool.labelDefault);
              return (
                <span key={tool.id} className="play-mode__tab-wrap">
                  <button
                    role="tab"
                    aria-selected={activeTab === tool.id}
                    onClick={() => setActiveTab(tool.id)}
                  >
                    {label}
                  </button>
                  <button
                    className="play-mode__tab-close"
                    aria-label={`${label} ${closeLabel}`}
                    onClick={() => closeTool(tool.id)}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>

          <div role="tabpanel" className="play-mode__panel">
            {activeTab === STATIC_WHITEBOARD && (
              <div className="play-mode__whiteboard">
                <div className="play-mode__whiteboard-toolbar">
                  <select
                    aria-label={t('playMode.widgetType', 'Widget-Typ')}
                    value={widgetType}
                    onChange={(e) => setWidgetType(e.target.value)}
                  >
                    {WIDGET_TYPES.map((w) => (
                      <option key={w.id} value={w.id}>
                        {t(w.labelKey, w.labelDefault)}
                      </option>
                    ))}
                  </select>
                  <button className="btn" onClick={addWidget}>
                    {t('playMode.addWidget', 'Widget hinzufügen')}
                  </button>
                </div>
                <ul className="play-mode__widgets">
                  {widgets.map((w) => (
                    <li key={w.key}>
                      <span>{w.label}</span>
                      <button aria-label={`${w.label} ${removeLabel}`} onClick={() => removeWidget(w.key)}>
                        {removeLabel}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {activeTab === STATIC_MAP && (
              <div className="play-mode__map">{t('playMode.tabMap', 'Karte')}</div>
            )}
            {openTools.map(
              (tool) => activeTab === tool.id && <div key={tool.id}>{t(tool.labelKey, tool.labelDefault)}</div>,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
