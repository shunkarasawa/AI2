import { useId, type ReactNode } from 'react';

export function Row({
  title,
  desc,
  aside,
}: {
  title: ReactNode;
  desc?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="row">
      <div className="row-body">
        <div className="row-title">{title}</div>
        {desc ? <div className="row-desc">{desc}</div> : null}
      </div>
      {aside ? <div className="row-aside">{aside}</div> : null}
    </div>
  );
}

export function SwitchRow({
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const descId = useId();
  return (
    <div className="row">
      <div className="row-body">
        <div className="row-title">{title}</div>
        {desc ? (
          <div className="row-desc" id={descId}>
            {desc}
          </div>
        ) : null}
      </div>
      {/* disabled にするとタブ順から外れ、「なぜ切り替えられないのか」を
          読み上げで確認できなくなる（iOS では振動の行が常にこの状態になる） */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        aria-disabled={disabled}
        aria-describedby={desc ? descId : undefined}
        className="switch"
        onClick={() => {
          if (disabled) return;
          onChange(!checked);
        }}
      />
    </div>
  );
}

export function SliderRow({
  title,
  value,
  onChange,
  format,
}: {
  title: string;
  value: number;
  onChange: (next: number) => void;
  format?: (value: number) => string;
}) {
  const percent = Math.round(value * 100);
  return (
    <div className="row" style={{ display: 'block' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.25rem',
        }}
      >
        <span className="row-title">{title}</span>
        <span className="row-aside">{format ? format(value) : `${percent}%`}</span>
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        aria-label={title}
        // これがないと「70」とだけ読まれる
        aria-valuetext={format ? format(value) : `${percent}%`}
        onChange={(e) => onChange(Number(e.currentTarget.value) / 100)}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {note ? <span className="section-note">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}
