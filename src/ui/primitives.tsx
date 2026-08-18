import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';
import './primitives.css';

type ButtonTone = 'neutral' | 'accent' | 'danger';
type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'glass';
type ButtonSize = 'md' | 'compact' | 'icon';
type ButtonShape = 'default' | 'circle';
type StatusTone = 'muted' | 'success' | 'warning' | 'failure';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
};

type PanelProps = HTMLAttributes<HTMLElement> & {
  /** default = inline surface card (no shadow) · popover = + drop shadow.
   *  Positioning/padding via className. */
  variant?: 'default' | 'popover';
  children: ReactNode;
};

type TabOption = {
  id: string;
  label: string;
  disabled?: boolean;
};

type TabsProps = {
  activeId: string;
  options: readonly TabOption[];
  onSelect: (id: string) => void;
  label: string;
  /** Stretch the tabs to fill the strip's width (equal-width tabs). */
  fill?: boolean;
  /** Positioning / layout only — merged onto the tablist wrapper. */
  className?: string;
};

type SegmentedOption = {
  id: string;
  label: ReactNode;
  title?: string;
};

type SegmentedProps = {
  value: string;
  options: readonly SegmentedOption[];
  onChange: (id: string) => void;
  label: string;
  orientation?: 'horizontal' | 'vertical';
  size?: ButtonSize;
  /** 'glass' = translucent framed pill with borderless (joined-look) buttons,
   *  for a control sitting over a canvas. Default = separated buttons. */
  variant?: 'default' | 'glass';
  disabled?: boolean;
  /** Positioning / layout only — merged onto the group wrapper. */
  className?: string;
};

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
  children: ReactNode;
};

type ChipProps = HTMLAttributes<HTMLElement> & {
  /** neutral = normal text · accent = accent-colored text. */
  tone?: 'neutral' | 'accent';
  /** soft = surface-active fill (default) · filled = accent-tinted · outline = border + muted text, transparent. */
  variant?: 'soft' | 'filled' | 'outline';
  /** sm = smaller font for dense rows (layer/channel chips). */
  size?: 'md' | 'sm';
  /** Pointer cursor + hover feedback (auto-on when as="button"). */
  interactive?: boolean;
  /** Toggle-selected look (accent fill) — for filter/facet chips. */
  selected?: boolean;
  /** Render as a real <button> for clickable toggles (keeps chip styling). */
  as?: 'span' | 'button';
  children: ReactNode;
};

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Button({
  tone = 'neutral',
  variant = 'solid',
  size = 'md',
  shape = 'default',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={className ? `ui-button ${className}` : 'ui-button'}
      data-tone={tone}
      data-variant={variant === 'solid' ? undefined : variant}
      data-size={size === 'md' ? undefined : size}
      data-shape={shape === 'default' ? undefined : shape}
      type={type}
      {...props}
    />
  );
}

export function Segmented({
  value,
  options,
  onChange,
  label,
  orientation = 'horizontal',
  size = 'md',
  variant = 'default',
  disabled = false,
  className,
}: SegmentedProps) {
  return (
    <div
      className={className ? `ui-segmented ${className}` : 'ui-segmented'}
      role="group"
      aria-label={label}
      data-orientation={orientation === 'horizontal' ? undefined : orientation}
      data-variant={variant === 'default' ? undefined : variant}
    >
      {options.map((option) => (
        <Button
          key={option.id}
          size={size}
          aria-pressed={option.id === value}
          disabled={disabled}
          title={option.title}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function Panel({ variant = 'default', children, className, ...props }: PanelProps) {
  return (
    <section
      className={className ? `ui-panel ${className}` : 'ui-panel'}
      data-variant={variant === 'default' ? undefined : variant}
      {...props}
    >
      {children}
    </section>
  );
}

export function Tabs({ activeId, options, onSelect, label, fill = false, className }: TabsProps) {
  const tabButtons: ReactNode[] = [];

  for (const option of options) {
    tabButtons.push(
      <button
        aria-selected={option.id === activeId}
        className="ui-tabs__tab"
        disabled={option.disabled}
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
    <nav
      aria-label={label}
      className={className ? `ui-tabs ${className}` : 'ui-tabs'}
      data-fill={fill ? '' : undefined}
      role="tablist"
    >
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

export function Chip({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  interactive = false,
  selected = false,
  as = 'span',
  children,
  className,
  ...props
}: ChipProps) {
  if (as === 'button') {
    return (
      <button
        type="button"
        className={className ? `ui-chip ${className}` : 'ui-chip'}
        data-tone={tone === 'neutral' ? undefined : tone}
        data-variant={variant === 'soft' ? undefined : variant}
        data-size={size === 'md' ? undefined : size}
        data-interactive=""
        data-selected={selected ? '' : undefined}
        {...props}
      >
        {children}
      </button>
    );
  }
  return (
    <span
      className={className ? `ui-chip ${className}` : 'ui-chip'}
      data-tone={tone === 'neutral' ? undefined : tone}
      data-variant={variant === 'soft' ? undefined : variant}
      data-size={size === 'md' ? undefined : size}
      data-interactive={interactive ? '' : undefined}
      data-selected={selected ? '' : undefined}
      {...props}
    >
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

type ListRowProps = HTMLAttributes<HTMLElement> & {
  /** Element to render. button (default, clickable a11y) · li (listbox option) · div (static). */
  as?: 'button' | 'div' | 'li';
  /** Selected state — left accent bar + accent tint. */
  selected?: boolean;
  /** flush = transparent list row (default) · card = bordered surface tile. */
  variant?: 'flush' | 'card';
  /** Hover/pointer feedback (default true; false for static rows). */
  interactive?: boolean;
  children: ReactNode;
};

export function ListRow({
  as = 'button',
  selected = false,
  variant = 'flush',
  interactive = true,
  children,
  className,
  ...props
}: ListRowProps) {
  const cls = className ? `ui-list-row ${className}` : 'ui-list-row';
  const dataVariant = variant === 'flush' ? undefined : variant;
  const dataSelected = selected ? '' : undefined;
  const dataInteractive = interactive ? '' : undefined;
  if (as === 'li') {
    return (
      <li className={cls} data-variant={dataVariant} data-selected={dataSelected} data-interactive={dataInteractive} {...props}>
        {children}
      </li>
    );
  }
  if (as === 'div') {
    return (
      <div className={cls} data-variant={dataVariant} data-selected={dataSelected} data-interactive={dataInteractive} {...props}>
        {children}
      </div>
    );
  }
  return (
    <button type="button" className={cls} data-variant={dataVariant} data-selected={dataSelected} data-interactive={dataInteractive} {...props}>
      {children}
    </button>
  );
}
