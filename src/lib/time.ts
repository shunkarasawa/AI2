export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatMinutes(totalMinutes: number): string {
  const m = Math.round(totalMinutes);
  if (m < 60) return `${m}分`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function formatDateJa(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()] ?? '';
  return `${date.getMonth() + 1}月${date.getDate()}日(${weekday})`;
}

export function formatRelativeDay(date: Date, today = new Date()): string {
  const diff = Math.round(
    (startOfDay(today).getTime() - startOfDay(date).getTime()) / 86_400_000,
  );
  if (diff === 0) return '今日';
  if (diff === 1) return '昨日';
  if (diff < 7) return `${diff}日前`;
  return formatDateJa(date);
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** ローカル日付の YYYY-MM-DD。UTC に寄せると日付がずれるので getFullYear 系で作る */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}
