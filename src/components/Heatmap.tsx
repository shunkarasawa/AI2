import { useEffect, useRef } from 'react';
import type { HeatCell } from '../lib/stats';
import { dayKey, formatDateJa } from '../lib/time';
import { ChartTip, useChartTip } from './ChartTip';

const DAY_LABELS = ['日', '', '火', '', '木', '', '土'] as const;

/**
 * 日ごとの瞑想時間を 4 段階の単色ランプで塗る（連続量なので単色。虹色にはしない）。
 * 薄い段は背景との差が小さいので、各マスは focus できて読み上げ文を持ち、
 * 数値そのものは下の週別グラフの表で読めるようにしてある。
 */
export function Heatmap({ grid, today = new Date() }: { grid: HeatCell[][]; today?: Date }) {
  const { hostRef, tip, show, hide } = useChartTip();
  const scroller = useRef<HTMLDivElement>(null);
  const todayKey = dayKey(today);

  // 横に溢れる場合は直近の週が見えている状態から始める
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [grid]);

  const describe = (cell: HeatCell) =>
    cell.sessions === 0 ? '記録なし' : `${Math.round(cell.minutes)}分 · ${cell.sessions}回`;

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
          <div className="heat-grid" onMouseLeave={hide}>
          {grid.map((week, index) => {
            const first = week[0];
            const previous = grid[index - 1]?.[0];
            const newMonth =
              first && (!previous || previous.date.getMonth() !== first.date.getMonth());
            return (
              <div className="heat-week" key={first?.key ?? index}>
                <span className="heat-monthlabel" aria-hidden="true">
                  {newMonth && first ? `${first.date.getMonth() + 1}月` : ''}
                </span>
                {week.map((cell) => (
                  <button
                    type="button"
                    key={cell.key}
                    className="heat-cell"
                    data-level={cell.level}
                    data-future={cell.future}
                    data-today={cell.key === todayKey}
                    disabled={cell.future}
                    aria-label={`${formatDateJa(cell.date)} ${describe(cell)}`}
                    onMouseEnter={(e) => show(e.currentTarget, formatDateJa(cell.date), describe(cell))}
                    onFocus={(e) => show(e.currentTarget, formatDateJa(cell.date), describe(cell))}
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
