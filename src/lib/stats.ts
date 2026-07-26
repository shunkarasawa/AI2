import type { SessionRecord } from './storage';
import { addDays, dayKey, startOfDay } from './time';

export interface DayTotal {
  key: string;
  date: Date;
  minutes: number;
  sessions: number;
}

export interface Summary {
  sessions: number;
  minutes: number;
  currentStreak: number;
  longestStreak: number;
  /** 記録がある日の平均分数 */
  averageMinutes: number;
}

export function aggregateByDay(records: readonly SessionRecord[]): Map<string, DayTotal> {
  const map = new Map<string, DayTotal>();
  for (const record of records) {
    const date = new Date(record.startedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    const entry = map.get(key) ?? { key, date: startOfDay(date), minutes: 0, sessions: 0 };
    entry.minutes += record.durationSec / 60;
    entry.sessions += 1;
    map.set(key, entry);
  }
  return map;
}

/**
 * 連続日数。今日まだ座っていなくても昨日座っていれば途切れた扱いにしない
 * （その日が終わるまでは猶予がある、という数え方）。
 */
export function computeStreaks(
  byDay: Map<string, DayTotal>,
  today = new Date(),
): { current: number; longest: number } {
  if (byDay.size === 0) return { current: 0, longest: 0 };

  const has = (date: Date) => byDay.has(dayKey(date));
  const base = startOfDay(today);

  let current = 0;
  let anchor: Date | null = null;
  if (has(base)) anchor = base;
  else if (has(addDays(base, -1))) anchor = addDays(base, -1);

  if (anchor) {
    let cursor = anchor;
    while (has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    }
  }

  const keys = [...byDay.keys()].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of keys) {
    const entry = byDay.get(key);
    if (!entry) continue;
    const gap = previous
      ? Math.round((entry.date.getTime() - previous.getTime()) / 86_400_000)
      : null;
    run = gap === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = entry.date;
  }

  return { current, longest };
}

export function summarize(records: readonly SessionRecord[], today = new Date()): Summary {
  const byDay = aggregateByDay(records);
  const minutes = records.reduce((total, r) => total + r.durationSec / 60, 0);
  const { current, longest } = computeStreaks(byDay, today);
  return {
    sessions: records.length,
    minutes,
    currentStreak: current,
    longestStreak: longest,
    averageMinutes: byDay.size === 0 ? 0 : minutes / byDay.size,
  };
}

export interface HeatCell {
  key: string;
  date: Date;
  minutes: number;
  sessions: number;
  /** 0（記録なし）〜 4 */
  level: 0 | 1 | 2 | 3 | 4;
  /** 未来の日付。マスとしては置くが値は持たない */
  future: boolean;
}

/** 分数を 4 段階に丸める。しきい値は「1回あたり10分」を基準にした */
export function heatLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 10) return 1;
  if (minutes < 20) return 2;
  if (minutes < 30) return 3;
  return 4;
}

/**
 * 日曜始まりの列（週）を weeks 本並べたグリッド。
 * 日本のカレンダー表記に合わせて行は 日〜土。
 */
export function buildHeatmap(
  records: readonly SessionRecord[],
  weeks: number,
  today = new Date(),
): HeatCell[][] {
  const byDay = aggregateByDay(records);
  const base = startOfDay(today);
  const thisWeekSunday = addDays(base, -base.getDay());
  const firstSunday = addDays(thisWeekSunday, -(weeks - 1) * 7);

  const grid: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstSunday, w * 7 + d);
      const key = dayKey(date);
      const entry = byDay.get(key);
      const minutes = entry?.minutes ?? 0;
      column.push({
        key,
        date,
        minutes,
        sessions: entry?.sessions ?? 0,
        level: heatLevel(minutes),
        future: date.getTime() > base.getTime(),
      });
    }
    grid.push(column);
  }
  return grid;
}

export interface WeekTotal {
  start: Date;
  end: Date;
  minutes: number;
  sessions: number;
  /** 今日を含む週 */
  current: boolean;
}

export function buildWeeklyTotals(
  records: readonly SessionRecord[],
  weeks: number,
  today = new Date(),
): WeekTotal[] {
  const byDay = aggregateByDay(records);
  const base = startOfDay(today);
  const thisWeekSunday = addDays(base, -base.getDay());

  const out: WeekTotal[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(thisWeekSunday, -w * 7);
    let minutes = 0;
    let sessions = 0;
    for (let d = 0; d < 7; d++) {
      const entry = byDay.get(dayKey(addDays(start, d)));
      if (!entry) continue;
      minutes += entry.minutes;
      sessions += entry.sessions;
    }
    out.push({ start, end: addDays(start, 6), minutes, sessions, current: w === 0 });
  }
  return out;
}
