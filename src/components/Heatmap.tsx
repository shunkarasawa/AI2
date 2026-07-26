import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeatCell } from '../lib/stats';
import { dayKey, formatDateJa } from '../lib/time';
import { ChartTip, useChartTip } from './ChartTip';

const DAY_LABELS = ['日', '', '火', '', '木', '', '土'] as const;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/**
 * 日ごとの瞑想時間を 4 段階の単色ランプで塗る（連続量なので単色。虹色にはしない）。
 *
 * マスを1つずつタブ移動できるようにすると、この画面だけで Tab を 141 回押すことになる。
 * グリッド全体を1つのタブ位置にして、中は矢印キーで動かす（ロービング tabindex）。
 * 薄い段は背景との差が小さいので、各マスは読み上げ用の文を持ち、
 * 数値そのものは下の週別グラフの表でも読める。
 */
export function Heatmap({ grid, today = new Date() }: { grid: HeatCell[][]; today?: Date }) {
  const { hostRef, tip, show, hide } = useChartTip();
  const scroller = useRef<HTMLDivElement>(null);
  const todayKey = dayKey(today);

  const index = useMemo(() => {
    const map = new Map<string, [number, number]>();
    grid.forEach((week, w) => week.forEach((cell, d) => map.set(cell.key, [w, d])));
    return map;
  }, [grid]);

  // タブで入ってきたときに最初に当たるマス。既定は今日
  const lastReal = useMemo(() => {
    for (let w = grid.length - 1; w >= 0; w--) {
      const week = grid[w];
      if (!week) continue;
      for (let d = 6; d >= 0; d--) {
        const cell = week[d];
        if (cell && !cell.future) return cell.key;
      }
    }
    return grid[0]?.[0]?.key ?? '';
  }, [grid]);

  const [cursor, setCursor] = useState(todayKey);
  const active = index.has(cursor) ? cursor : lastReal;

  // 横に溢れる場合は直近の週が見えている状態から始める
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [grid]);

  const describe = (cell: HeatCell) =>
    cell.sessions === 0 ? '記録なし' : `${Math.round(cell.minutes)}分 · ${cell.sessions}回`;

  const move = (deltaWeek: number, deltaDay: number) => {
    const at = index.get(active);
    if (!at) return;
    const [w, d] = at;
    const next = grid[clamp(w + deltaWeek, 0, grid.length - 1)]?.[clamp(d + deltaDay, 0, 6)];
    if (!next || next.future) return;
    setCursor(next.key);
    requestAnimationFrame(() => {
      scroller.current?.querySelector<HTMLElement>(`[data-key="${next.key}"]`)?.focus();
    });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = moves[event.key];
    if (!delta) return;
    event.preventDefault();
    move(delta[0], delta[1]);
  };

  return (
    <div ref={hostRef} style={{ position: 'relative' }}>
      <div className="heatmap">
        {/* 曜日のラベルは横スクロールの外に置く（一緒に流れると意味を失う） */}
        <div className="heat-daylabels" aria-hidden="true">
          {DAY_LABELS.map((label, i) => (
            <span className="heat-daylabel" key={i}>
              {label}
            </span>
          ))}
        </div>

        <div className="heat-scroll" ref={scroller}>
          <div
            className="heat-grid"
            role="grid"
            aria-label="日ごとの瞑想時間。矢印キーで日を移動します"
            onKeyDown={onKeyDown}
            onMouseLeave={hide}
          >
            {grid.map((week, weekIndex) => {
              const first = week[0];
              const previous = grid[weekIndex - 1]?.[0];
              const newMonth =
                first && (!previous || previous.date.getMonth() !== first.date.getMonth());
              return (
                <div className="heat-week" role="row" key={first?.key ?? weekIndex}>
                  <span className="heat-monthlabel" role="presentation" aria-hidden="true">
                    {newMonth && first ? `${first.date.getMonth() + 1}月` : ''}
                  </span>
                  {week.map((cell) => (
                    <div
                      key={cell.key}
                      role="gridcell"
                      data-key={cell.key}
                      className="heat-cell"
                      data-level={cell.level}
                      data-future={cell.future}
                      data-today={cell.key === todayKey}
                      tabIndex={cell.future ? -1 : cell.key === active ? 0 : -1}
                      aria-label={`${formatDateJa(cell.date)} ${describe(cell)}`}
                      onMouseEnter={(e) =>
                        show(e.currentTarget, formatDateJa(cell.date), describe(cell))
                      }
                      onFocus={(e) => {
                        setCursor(cell.key);
                        show(e.currentTarget, formatDateJa(cell.date), describe(cell));
                      }}
                      onBlur={hide}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="heat-legend" aria-hidden="true">
        <span>少ない</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className="swatch" style={{ background: `var(--heat-${level})` }} />
        ))}
        <span>多い</span>
      </div>

      {tip ? <ChartTip tip={tip} /> : null}
    </div>
  );
}
