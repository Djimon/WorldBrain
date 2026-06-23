import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import './primitives.css';

type ButtonTone = 'neutral' | 'accent';
type StatusTone = 'muted' | 'success' | 'warning' | 'failure';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
};

type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

type TabOption = {
  id: string;
  label: string;
};

type TabsProps = {
  activeId: string;
  options: readonly TabOption[];
  onSelect: (id: string) => void;
  label: string;
};

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
  children: ReactNode;
};

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Button({ tone = 'neutral', type = 'button', ...props }: ButtonProps) {
  return <button className="ui-button" data-tone={tone} type={type} {...props} />;
}

export function Panel({ children, ...props }: PanelProps) {
  return (
    <section className="ui-panel" {...props}>
      <div className="ui-panel__body">{children}</div>
    </section>
  );
}

export function Tabs({ activeId, options, onSelect, label }: TabsProps) {
  const tabButtons: ReactNode[] = [];

  for (const option of options) {
    tabButtons.push(
      <button
        aria-selected={option.id === activeId}
        className="ui-tabs__tab"
        key={option.id}
        onClick={() => onSelect(option.id)}
        role="tab"
        type="button"
      >
        {option.label}
      </button>,
    );
  }

  return (
    <nav aria-label={label} className="ui-tabs" role="tablist">
      {tabButtons}
    </nav>
  );
}

export function Field({ label, hint, id, ...props }: FieldProps) {
  const controlId = id ?? `field-${label.replace(/\s+/gu, '-').toLowerCase()}`;
  const hintId = hint === undefined ? undefined : `${controlId}-hint`;

  return (
    <label className="ui-field" htmlFor={controlId}>
      <span className="ui-field__label">{label}</span>
      <input aria-describedby={hintId} className="ui-field__control" id={controlId} {...props} />
      {hint === undefined ? null : (
        <span className="ui-field__hint" id={hintId}>
          {hint}
        </span>
      )}
    </label>
  );
}

export function StatusChip({ tone = 'muted', children, ...props }: StatusChipProps) {
  return (
    <span className="ui-status-chip" data-tone={tone} {...props}>
      {children}
    </span>
  );
}

export function TableSurface({ children, ...props }: SurfaceProps) {
  return (
    <div className="ui-table-surface" {...props}>
      {children}
    </div>
  );
}

export function ListSurface({ children, ...props }: SurfaceProps) {
  return (
    <div className="ui-list-surface" {...props}>
      {children}
    </div>
  );
}
