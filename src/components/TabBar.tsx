import type { ReactElement } from 'react';
import { IconChart, IconGear, IconLotus } from './icons';

export type Tab = 'home' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; Icon: (props: { className?: string }) => ReactElement }[] = [
  { id: 'home', label: '瞑想', Icon: IconLotus },
  { id: 'stats', label: '記録', Icon: IconChart },
  { id: 'settings', label: '設定', Icon: IconGear },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (next: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="メイン">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="tab"
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
