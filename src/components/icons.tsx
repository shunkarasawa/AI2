/** 線画のアイコン。ライブラリを足さずに済むぶんだけ手で持つ */

type Props = { className?: string };

const base = {
  // 既定サイズを属性で持たせる。属性がないと親幅いっぱいに広がってしまう
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function IconLotus({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4c1.9 1.8 2.9 3.9 2.9 6.2 0 1.7-.6 3.2-1.8 4.6" />
      <path d="M12 4c-1.9 1.8-2.9 3.9-2.9 6.2 0 1.7.6 3.2 1.8 4.6" />
      <path d="M4.5 9.4c2.4.5 4.2 1.7 5.4 3.5.9 1.4 1.3 2.9 1.2 4.6" />
      <path d="M19.5 9.4c-2.4.5-4.2 1.7-5.4 3.5-.9 1.4-1.3 2.9-1.2 4.6" />
      <path d="M3.5 17.5c2.3 1.7 5.1 2.5 8.5 2.5s6.2-.8 8.5-2.5" />
    </svg>
  );
}

export function IconChart({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 19.5h16" />
      <rect x="5.5" y="12" width="3.4" height="5" rx="1" />
      <rect x="10.8" y="7.5" width="3.4" height="9.5" rx="1" />
      <rect x="16.1" y="10" width="3.4" height="7" rx="1" />
    </svg>
  );
}

export function IconGear({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M4.9 7.8l1.7 1M17.4 15.2l1.7 1M4.9 16.2l1.7-1M17.4 8.8l1.7-1" />
      <circle cx="12" cy="12" r="8.2" opacity=".35" />
    </svg>
  );
}

export function IconPlay({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M8.5 5.6 18 12l-9.5 6.4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="7" y="5.5" width="3.2" height="13" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="13.8" y="5.5" width="3.2" height="13" rx="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconStop({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconClose({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

export function IconFlame({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.2c3.4 3 5.1 5.7 5.1 8.2a5.1 5.1 0 0 1-10.2 0c0-1 .3-2 .9-3 .2 1.2.8 1.9 1.7 2.1.6-2.6 1.4-5 2.5-7.3z" />
      <path d="M12 19a2.4 2.4 0 0 1-2.4-2.4c0-1.1.8-2.2 2.4-3.4 1.6 1.2 2.4 2.3 2.4 3.4A2.4 2.4 0 0 1 12 19z" />
    </svg>
  );
}

export function IconSpeaker({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M11 5.5 6.8 9H4.2v6h2.6L11 18.5z" />
      <path d="M14.6 9.2a4 4 0 0 1 0 5.6" />
      <path d="M17.2 6.8a7.4 7.4 0 0 1 0 10.4" opacity=".5" />
    </svg>
  );
}

export function IconMute({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M11 5.5 6.8 9H4.2v6h2.6L11 18.5z" />
      <path d="M15 10l4 4M19 10l-4 4" />
    </svg>
  );
}

export function IconBell({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 16.5c1-1.1 1.5-2.6 1.5-4.4V11a4 4 0 0 1 8 0v1.1c0 1.8.5 3.3 1.5 4.4z" />
      <path d="M4.5 16.5h15M10.4 19.4a1.8 1.8 0 0 0 3.2 0" />
    </svg>
  );
}

export function IconCheck({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M5.5 12.5l4 4 9-9" strokeWidth={2} />
    </svg>
  );
}

export function IconDownload({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v10M8 10.5l4 4 4-4M5 19h14" />
    </svg>
  );
}

export function IconUpload({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 15V5M8 8.5l4-4 4 4M5 19h14" />
    </svg>
  );
}
