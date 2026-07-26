import { useCallback, useRef, useState } from 'react';

export interface TipState {
  x: number;
  y: number;
  hostWidth: number;
  title: string;
  body: string;
}

/** 画面端でツールチップが切れないように、寄せる方向を変える閾値 */
const EDGE = 76;
const MARGIN = 6;

/**
 * グラフのツールチップ。中身に応じた幅を測らずに済ませるため、
 * 端に近いときは中央寄せをやめて左端・右端に揃える。
 */
export function ChartTip({ tip }: { tip: TipState }) {
  const align = tip.x < EDGE ? 'start' : tip.x > tip.hostWidth - EDGE ? 'end' : 'center';
  const left = align === 'start' ? MARGIN : align === 'end' ? tip.hostWidth - MARGIN : tip.x;
  return (
    <div className="tip" data-align={align} style={{ left, top: tip.y }} role="presentation">
      <span className="tip-key">{tip.title}</span>
      <br />
      {tip.body}
    </div>
  );
}

/** ホスト要素の中での位置を計算してツールチップを出し入れするための道具 */
export function useChartTip() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const show = useCallback((target: HTMLElement, title: string, body: string) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = target.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    setTip({
      x: rect.left - hostRect.left + rect.width / 2,
      y: rect.top - hostRect.top,
      hostWidth: hostRect.width,
      title,
      body,
    });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  return { hostRef, tip, show, hide };
}
