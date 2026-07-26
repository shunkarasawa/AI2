/**
 * 保存はすべて localStorage。サーバーもアカウントも持たない。
 * 記録が端末から出ないことがこのアプリの前提なので、同期機能は入れない代わりに
 * 設定画面から JSON の書き出し・読み込みができるようにしてある。
 */

import type { AmbientId } from '../audio/ambient';
import type { BellTone } from '../audio/bell';
import { DEFAULT_PATTERN } from './patterns';

export type SessionMode = 'breath' | 'silent';

export interface SessionRecord {
  id: string;
  /** 開始時刻（ISO 文字列） */
  startedAt: string;
  /** 実際に座っていた秒数 */
  durationSec: number;
  /** 設定していた秒数 */
  plannedSec: number;
  mode: SessionMode;
  patternId?: string;
  /** 最後まで終えたか（途中でやめた場合は false） */
  completed: boolean;
}

export interface SessionConfig {
  mode: SessionMode;
  patternId: string;
  durationSec: number;
  ambient: AmbientId | 'none';
  startBell: boolean;
  endBell: boolean;
  /** 途中のベルの間隔（分）。0 で鳴らさない */
  intervalBellMin: number;
}

export interface Settings {
  theme: 'system' | 'dark' | 'light';
  bellVolume: number;
  ambientVolume: number;
  /** 呼吸の切り替わりで振動させる */
  haptics: boolean;
  /** セッション中に画面を消さない */
  keepAwake: boolean;
  /** 呼吸の数字カウントダウンを表示する */
  showCountdown: boolean;
}

export interface Backup {
  version: 1;
  exportedAt: string;
  sessions: SessionRecord[];
  settings: Settings;
  config: SessionConfig;
}

const KEY_SESSIONS = 'shizuka.sessions.v1';
const KEY_SETTINGS = 'shizuka.settings.v1';
const KEY_CONFIG = 'shizuka.config.v1';

export const DEFAULT_CONFIG: SessionConfig = {
  mode: 'breath',
  patternId: DEFAULT_PATTERN.id,
  durationSec: 5 * 60,
  ambient: 'none',
  startBell: true,
  endBell: true,
  intervalBellMin: 0,
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  bellVolume: 0.7,
  ambientVolume: 0.5,
  haptics: true,
  keepAwake: true,
  showCountdown: true,
};

export const BELL_TONES: Record<'start' | 'interval' | 'end', BellTone> = {
  start: 'bowl',
  interval: 'chime',
  end: 'gong',
};

/** これより短いセッションは記録しない（誤タップや音の確認を残さないため） */
export const MIN_RECORD_SEC = 30;

export function isWorthRecording(durationSec: number): boolean {
  return Math.round(durationSec) >= MIN_RECORD_SEC;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return fallback;
    // 配列とオブジェクトを取り違えたデータは捨てる。
    // 形の判定を parsed 側でやると、settings に [] が入ったときに
    // それを設定として返してしまい、音量が undefined になる
    if (Array.isArray(parsed) !== Array.isArray(fallback)) return fallback;
    // 後からキーを増やしても壊れないように、既定値へ重ねる
    return Array.isArray(parsed) ? (parsed as T) : { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

/** 0〜1 の音量。壊れた値は既定値に戻す（AudioParam に NaN を渡すと例外になる） */
function volume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * 手書き・旧版・他人のバックアップを取り込んでも壊れないよう、値の型まで整える。
 * ここを通さないと、例えば bellVolume: "loud" が AudioParam に渡って
 * 「はじめる」が無反応になり、しかも localStorage に残るので直せなくなる。
 */
export function normalizeSettings(value: Partial<Settings> | undefined): Settings {
  const v = value ?? {};
  return {
    theme: oneOf(v.theme, ['system', 'dark', 'light'] as const, DEFAULT_SETTINGS.theme),
    bellVolume: volume(v.bellVolume, DEFAULT_SETTINGS.bellVolume),
    ambientVolume: volume(v.ambientVolume, DEFAULT_SETTINGS.ambientVolume),
    haptics: bool(v.haptics, DEFAULT_SETTINGS.haptics),
    keepAwake: bool(v.keepAwake, DEFAULT_SETTINGS.keepAwake),
    showCountdown: bool(v.showCountdown, DEFAULT_SETTINGS.showCountdown),
  };
}

export function normalizeConfig(value: Partial<SessionConfig> | undefined): SessionConfig {
  const v = value ?? {};
  const durationSec =
    typeof v.durationSec === 'number' && Number.isFinite(v.durationSec) && v.durationSec >= 1
      ? Math.min(6 * 60 * 60, Math.round(v.durationSec))
      : DEFAULT_CONFIG.durationSec;
  const interval =
    typeof v.intervalBellMin === 'number' && Number.isFinite(v.intervalBellMin)
      ? Math.max(0, v.intervalBellMin)
      : DEFAULT_CONFIG.intervalBellMin;
  return {
    mode: oneOf(v.mode, ['breath', 'silent'] as const, DEFAULT_CONFIG.mode),
    patternId: typeof v.patternId === 'string' ? v.patternId : DEFAULT_CONFIG.patternId,
    durationSec,
    ambient: typeof v.ambient === 'string' ? (v.ambient as SessionConfig['ambient']) : 'none',
    startBell: bool(v.startBell, DEFAULT_CONFIG.startBell),
    endBell: bool(v.endBell, DEFAULT_CONFIG.endBell),
    // 長さより長い間隔は成立しないので落とす
    intervalBellMin: interval * 60 >= durationSec ? 0 : interval,
  };
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* プライベートブラウジング等で書けない場合は黙って諦める */
  }
}

export function loadSessions(): SessionRecord[] {
  const list = read<SessionRecord[]>(KEY_SESSIONS, []);
  if (!Array.isArray(list)) return [];
  return list.filter(isSessionRecord).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (value === null || typeof value !== 'object') return false;
  const r = value as Partial<SessionRecord>;
  return (
    typeof r.startedAt === 'string' &&
    // 日付として読めないものを通すと、合計と1日平均の分母がずれる
    !Number.isNaN(new Date(r.startedAt).getTime()) &&
    typeof r.durationSec === 'number' &&
    // 1e999 は JSON.parse で Infinity になり typeof を通り抜ける
    Number.isFinite(r.durationSec) &&
    r.durationSec >= 0
  );
}

export function saveSessions(sessions: SessionRecord[]): void {
  write(KEY_SESSIONS, sessions);
}

export function loadSettings(): Settings {
  return normalizeSettings(read<Settings>(KEY_SETTINGS, DEFAULT_SETTINGS));
}

export function saveSettings(settings: Settings): void {
  write(KEY_SETTINGS, settings);
}

export function loadConfig(): SessionConfig {
  return normalizeConfig(read<SessionConfig>(KEY_CONFIG, DEFAULT_CONFIG));
}

export function saveConfig(config: SessionConfig): void {
  write(KEY_CONFIG, config);
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildBackup(
  sessions: SessionRecord[],
  settings: Settings,
  config: SessionConfig,
): Backup {
  return { version: 1, exportedAt: new Date().toISOString(), sessions, settings, config };
}

export function parseBackup(text: string): Backup | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<Backup>;
    if (!Array.isArray(candidate.sessions)) return null;
    return {
      version: 1,
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
      sessions: candidate.sessions.filter(isSessionRecord),
      settings: normalizeSettings(candidate.settings),
      config: normalizeConfig(candidate.config),
    };
  } catch {
    return null;
  }
}
