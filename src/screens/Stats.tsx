import { useMemo } from 'react';
import { Heatmap } from '../components/Heatmap';
import { Section } from '../components/ui';
import { WeeklyBars } from '../components/WeeklyBars';
import { getPattern } from '../lib/patterns';
import { buildHeatmap, buildWeeklyTotals, summarize } from '../lib/stats';
import type { SessionRecord } from '../lib/storage';
import { formatClock, formatMinutes, formatRelativeDay } from '../lib/time';

const HEATMAP_WEEKS = 21;
const BAR_WEEKS = 8;
const LOG_LIMIT = 12;

export function Stats({ sessions }: { sessions: SessionRecord[] }) {
  const { summary, heatmap, weekly, recent } = useMemo(() => {
    const today = new Date();
    return {
      summary: summarize(sessions, today),
      heatmap: buildHeatmap(sessions, HEATMAP_WEEKS, today),
      weekly: buildWeeklyTotals(sessions, BAR_WEEKS, today),
      recent: [...sessions].reverse().slice(0, LOG_LIMIT),
    };
  }, [sessions]);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">記録</h1>
        <p className="page-sub">
          続いた日数がいちばん大事な数字です。1回の長さは気にしなくていいものです。
        </p>
      </header>

      {sessions.length === 0 ? (
        <div className="card empty">
          まだ記録がありません。
          <br />
          30秒以上座ると、ここに残っていきます。
        </div>
      ) : (
        <>
          <Section title="いま">
            <div className="stat-grid">
              <Stat label="連続" value={summary.currentStreak} unit="日" />
              <Stat label="最長" value={summary.longestStreak} unit="日" />
              <Stat label="通算" value={summary.sessions} unit="回" />
              <Stat label="合計" value={formatMinutes(summary.minutes)} />
            </div>
          </Section>

          <Section title="この5か月" note={`1日あたり平均 ${Math.round(summary.averageMinutes)}分`}>
            <Heatmap grid={heatmap} />
          </Section>

          <Section title="週ごとの合計">
            <WeeklyBars weeks={weekly} />
          </Section>

          <Section title="最近">
            <div className="log">
              {recent.map((record) => {
                const started = new Date(record.startedAt);
                return (
                  <div className="log-item" key={record.id}>
                    <span className="log-dot" data-partial={!record.completed} />
                    <div className="log-main">
                      <div className="log-title">
                        {record.mode === 'breath'
                          ? getPattern(record.patternId ?? '').label
                          : '静かに座る'}
                      </div>
                      <div className="log-sub">
                        {formatRelativeDay(started)} {formatTime(started)}
                        {record.completed ? '' : ' · 途中でやめた'}
                      </div>
                    </div>
                    <span className="log-time">{formatClock(record.durationSec)}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      {/* 「11時間28分」のような長い値は折り返さずに一段小さく出す */}
      <div className="stat-value" data-long={typeof value === 'string' && value.length > 4}>
        <span>{value}</span>
        {unit ? <span className="stat-unit">{unit}</span> : null}
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}
