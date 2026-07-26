import type { WeekTotal } from '../lib/stats';
import { formatMinutes } from '../lib/time';
import { ChartTip, useChartTip } from './ChartTip';

const label = (week: WeekTotal) => `${week.start.getMonth() + 1}/${week.start.getDate()}`;

/**
 * 週ごとの合計時間。系列は 1 本だけなので凡例は置かない（見出しが系列名を兼ねる）。
 * 数値ラベルは今週だけに付け、他は hover と下の表で読む。
 */
export function WeeklyBars({ weeks }: { weeks: WeekTotal[] }) {
  const { hostRef, tip, show, hide } = useChartTip();
  const max = Math.max(...weeks.map((w) => w.minutes), 1);

  return (
    <div ref={hostRef} style={{ position: 'relative' }}>
      <div className="bars" onMouseLeave={hide}>
        {weeks.map((week) => {
          const height = week.minutes === 0 ? 0 : Math.max(2, (week.minutes / max) * 100);
          const body =
            week.sessions === 0 ? '記録なし' : `${formatMinutes(week.minutes)} · ${week.sessions}回`;
          return (
            <button
              type="button"
              className="bar-col"
              key={week.start.toISOString()}
              data-current={week.current}
              aria-label={`${label(week)}の週 ${Math.round(week.minutes)}分`}
              onMouseEnter={(e) => show(e.currentTarget, `${label(week)} の週`, body)}
              onFocus={(e) => show(e.currentTarget, `${label(week)} の週`, body)}
              onBlur={hide}
            >
              <div className="bar-track">
                {week.current && week.minutes > 0 ? (
                  <span className="bar-value">{Math.round(week.minutes)}分</span>
                ) : null}
                <div className="bar-fill" style={{ height: `${height}%` }} />
              </div>
              <span className="bar-label">{label(week)}</span>
            </button>
          );
        })}
      </div>
      <div className="bars-baseline" />

      <details className="table-toggle">
        <summary>数値で見る</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">週のはじまり</th>
              <th scope="col">合計</th>
              <th scope="col">回数</th>
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map((week) => (
              <tr key={week.start.toISOString()}>
                <th scope="row" style={{ fontWeight: 400 }}>
                  {label(week)}
                  {week.current ? '（今週）' : ''}
                </th>
                <td>{week.minutes === 0 ? '—' : `${Math.round(week.minutes)}分`}</td>
                <td>{week.sessions === 0 ? '—' : `${week.sessions}回`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {tip ? <ChartTip tip={tip} /> : null}
    </div>
  );
}
