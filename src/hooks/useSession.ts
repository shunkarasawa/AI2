/**
 * セッションの進行を司る。
 *
 * 設計上の要点:
 *   - 経過時間は performance.now() の差分で出す。setInterval を数える方式だと
 *     タブが裏に回った瞬間にずれるが、この方式なら復帰時に正しい位置へ戻る。
 *   - 60fps で更新したい値（円の大きさ）は React の state に入れず、
 *     onFrame 経由で呼び出し側が直接 DOM に書く。
 *     state を更新するのは表示される整数が変わったときだけ。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AMBIENT_BY_ID, startAmbient, type AmbientHandle } from '../audio/ambient';
import { playBell } from '../audio/bell';
import { unlockAudio } from '../audio/context';
import { haptics } from '../lib/haptics';
import { cycleSeconds, getPattern, type PhaseKind } from '../lib/patterns';
import {
  BELL_TONES,
  newId,
  type SessionConfig,
  type SessionRecord,
  type Settings,
} from '../lib/storage';

export type EngineState = 'idle' | 'running' | 'paused' | 'finished';

/** 円を描くのに必要な、毎フレーム変わる値 */
export interface Frame {
  /** 0（閉じている）〜 1（開いている） */
  openness: number;
  /** セッション全体の進み具合 0〜1 */
  progress: number;
}

/** 文字として表示される、秒単位で変わる値 */
export interface Coarse {
  elapsed: number;
  remaining: number;
  phase: PhaseKind | null;
  /** その区間の残り秒数（切り上げ。4,3,2,1 と出す） */
  phaseCountdown: number;
  cycles: number;
}

interface Options {
  config: SessionConfig;
  settings: Settings;
  onFinish: (record: SessionRecord, completed: boolean) => void;
}

/** 裏に回っている間に過ぎたベルは鳴らさない（戻った瞬間に連打されないように） */
const BELL_TOLERANCE = 2;
const ORB_MIN = 0.34;

const easeInOutSine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x));

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function orbScale(openness: number): number {
  return ORB_MIN + (1 - ORB_MIN) * openness;
}

interface PhaseAt {
  kind: PhaseKind;
  remaining: number;
  progress: number;
  cycle: number;
}

function phaseAt(elapsed: number, patternId: string): PhaseAt | null {
  const pattern = getPattern(patternId);
  const total = cycleSeconds(pattern);
  if (total <= 0) return null;
  const cycle = Math.floor(elapsed / total);
  let t = elapsed - cycle * total;
  for (const phase of pattern.phases) {
    if (t < phase.seconds) {
      return {
        kind: phase.kind,
        remaining: phase.seconds - t,
        progress: t / phase.seconds,
        cycle,
      };
    }
    t -= phase.seconds;
  }
  return null;
}

function opennessOf(phase: PhaseAt | null): number {
  if (!phase) return 0;
  switch (phase.kind) {
    case 'inhale':
      return easeInOutSine(phase.progress);
    case 'holdIn':
      return 1;
    case 'exhale':
      return 1 - easeInOutSine(phase.progress);
    case 'holdOut':
      return 0;
  }
}

export function useSession({ config, settings, onFinish }: Options) {
  const [state, setState] = useState<EngineState>('idle');
  /** 最後のセッションを最後まで終えたか。終了画面の文言に使う */
  const [lastCompleted, setLastCompleted] = useState(false);
  const [coarse, setCoarse] = useState<Coarse>({
    elapsed: 0,
    remaining: config.durationSec,
    phase: null,
    phaseCountdown: 0,
    cycles: 0,
  });

  const frameCb = useRef<((frame: Frame) => void) | null>(null);
  const rafRef = useRef<number | null>(null);

  const startedAt = useRef(0);
  const pausedTotal = useRef(0);
  const pausedAt = useRef<number | null>(null);

  const ambientRef = useRef<AmbientHandle | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const nextBellRef = useRef(1);
  const lastPhaseRef = useRef<PhaseKind | null>(null);
  const startedIsoRef = useRef('');

  // ループの中から常に最新の設定を見るための参照
  const configRef = useRef(config);
  const settingsRef = useRef(settings);
  const onFinishRef = useRef(onFinish);
  configRef.current = config;
  settingsRef.current = settings;
  onFinishRef.current = onFinish;

  const elapsedNow = useCallback(() => {
    const end = pausedAt.current ?? performance.now();
    return Math.max(0, (end - startedAt.current - pausedTotal.current) / 1000);
  }, []);

  // ---------------------------------------------------------- 画面スリープ抑止

  const releaseWakeLock = useCallback(() => {
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    void sentinel?.release().catch(() => undefined);
  }, []);

  const acquireWakeLock = useCallback(async () => {
    if (!settingsRef.current.keepAwake) return;
    if (!('wakeLock' in navigator)) return;
    if (wakeLockRef.current) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch {
      /* 非対応・電源状態などで拒否された場合は諦める */
    }
  }, []);

  // ---------------------------------------------------------- 環境音

  const stopAmbient = useCallback((fade?: number) => {
    ambientRef.current?.stop(fade);
    ambientRef.current = null;
  }, []);

  const startAmbientIfNeeded = useCallback(() => {
    const { ambient } = configRef.current;
    if (ambient === 'none' || !AMBIENT_BY_ID[ambient]) return;
    if (ambientRef.current?.id === ambient) return;
    stopAmbient(0.4);
    ambientRef.current = startAmbient(ambient, settingsRef.current.ambientVolume);
  }, [stopAmbient]);

  // ---------------------------------------------------------- 終了処理

  const finish = useCallback(
    (completed: boolean) => {
      const elapsed = Math.min(elapsedNow(), configRef.current.durationSec);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      releaseWakeLock();

      if (completed && configRef.current.endBell) {
        playBell(BELL_TONES.end, settingsRef.current.bellVolume);
        if (settingsRef.current.haptics) haptics.bookend();
      }
      stopAmbient(completed ? 3.5 : 1.2);

      const cfg = configRef.current;
      const record: SessionRecord = {
        id: newId(),
        startedAt: startedIsoRef.current || new Date().toISOString(),
        durationSec: Math.round(elapsed),
        plannedSec: cfg.durationSec,
        mode: cfg.mode,
        completed,
        ...(cfg.mode === 'breath' ? { patternId: cfg.patternId } : {}),
      };

      setLastCompleted(completed);
      setState('finished');
      setCoarse((prev) => ({
        ...prev,
        elapsed,
        remaining: Math.max(0, cfg.durationSec - elapsed),
        phase: null,
        phaseCountdown: 0,
      }));
      frameCb.current?.({ openness: 0, progress: completed ? 1 : elapsed / cfg.durationSec });
      onFinishRef.current(record, completed);
    },
    [elapsedNow, releaseWakeLock, stopAmbient],
  );

  // ---------------------------------------------------------- メインループ

  const loop = useCallback(() => {
    const cfg = configRef.current;
    const set = settingsRef.current;
    const elapsed = elapsedNow();

    if (elapsed >= cfg.durationSec) {
      finish(true);
      return;
    }

    const phase = cfg.mode === 'breath' ? phaseAt(elapsed, cfg.patternId) : null;

    // 途中のベル
    if (cfg.intervalBellMin > 0) {
      const target = nextBellRef.current * cfg.intervalBellMin * 60;
      if (elapsed >= target) {
        if (target < cfg.durationSec && elapsed - target < BELL_TOLERANCE) {
          playBell(BELL_TONES.interval, set.bellVolume);
        }
        nextBellRef.current += 1;
      }
    }

    // 呼吸の切り替わりで振動
    if (phase && phase.kind !== lastPhaseRef.current) {
      if (set.haptics && lastPhaseRef.current !== null) {
        if (phase.kind === 'holdIn' || phase.kind === 'holdOut') haptics.hold();
        else haptics.phase();
      }
      lastPhaseRef.current = phase.kind;
    }

    const progress = clamp01(elapsed / cfg.durationSec);
    frameCb.current?.({ openness: opennessOf(phase), progress });

    const countdown = phase ? Math.max(1, Math.ceil(phase.remaining)) : 0;
    setCoarse((prev) => {
      const remaining = Math.max(0, cfg.durationSec - elapsed);
      const sameSecond = Math.ceil(remaining) === Math.ceil(prev.remaining);
      if (
        sameSecond &&
        prev.phase === (phase?.kind ?? null) &&
        prev.phaseCountdown === countdown &&
        prev.cycles === (phase?.cycle ?? 0)
      ) {
        return prev;
      }
      return {
        elapsed,
        remaining,
        phase: phase?.kind ?? null,
        phaseCountdown: countdown,
        cycles: phase?.cycle ?? 0,
      };
    });

    rafRef.current = requestAnimationFrame(loop);
  }, [elapsedNow, finish]);

  // ---------------------------------------------------------- 操作

  const start = useCallback(async () => {
    await unlockAudio();
    startedAt.current = performance.now();
    pausedTotal.current = 0;
    pausedAt.current = null;
    nextBellRef.current = 1;
    lastPhaseRef.current = null;
    startedIsoRef.current = new Date().toISOString();

    const cfg = configRef.current;
    const set = settingsRef.current;
    if (cfg.startBell) playBell(BELL_TONES.start, set.bellVolume);
    if (set.haptics) haptics.bookend();
    startAmbientIfNeeded();
    void acquireWakeLock();

    setState('running');
    setCoarse({
      elapsed: 0,
      remaining: cfg.durationSec,
      phase: cfg.mode === 'breath' ? (phaseAt(0, cfg.patternId)?.kind ?? null) : null,
      phaseCountdown: 0,
      cycles: 0,
    });
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [acquireWakeLock, loop, startAmbientIfNeeded]);

  const pause = useCallback(() => {
    if (state !== 'running') return;
    pausedAt.current = performance.now();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    // 一時停止中は環境音を絞る（止めきらないのは、戻ったときに場が切れないように）
    ambientRef.current?.setVolume(settingsRef.current.ambientVolume * 0.18, 0.6);
    releaseWakeLock();
    setState('paused');
  }, [releaseWakeLock, state]);

  const resume = useCallback(() => {
    if (state !== 'paused' || pausedAt.current === null) return;
    pausedTotal.current += performance.now() - pausedAt.current;
    pausedAt.current = null;
    ambientRef.current?.setVolume(settingsRef.current.ambientVolume, 1.2);
    void acquireWakeLock();
    setState('running');
    rafRef.current = requestAnimationFrame(loop);
  }, [acquireWakeLock, loop, state]);

  const stop = useCallback(() => {
    if (state === 'idle' || state === 'finished') return;
    if (pausedAt.current !== null) {
      // 一時停止していた時間は座っていた時間に含めない
      pausedTotal.current += performance.now() - pausedAt.current;
      pausedAt.current = null;
    }
    finish(false);
  }, [finish, state]);

  const reset = useCallback(() => {
    setState('idle');
    setCoarse({
      elapsed: 0,
      remaining: configRef.current.durationSec,
      phase: null,
      phaseCountdown: 0,
      cycles: 0,
    });
    frameCb.current?.({ openness: 0, progress: 0 });
  }, []);

  const onFrame = useCallback((cb: ((frame: Frame) => void) | null) => {
    frameCb.current = cb;
  }, []);

  // 設定画面で音量を変えたら、鳴っている環境音にも即反映する
  useEffect(() => {
    if (state === 'running') ambientRef.current?.setVolume(settings.ambientVolume);
  }, [settings.ambientVolume, state]);

  // 画面を消して戻ってきたら wake lock を取り直す（解放されているため）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && state === 'running') void acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [acquireWakeLock, state]);

  // アンマウント時の後始末
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ambientRef.current?.stop(0.3);
      ambientRef.current = null;
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      void sentinel?.release().catch(() => undefined);
    },
    [],
  );

  return { state, coarse, lastCompleted, start, pause, resume, stop, reset, onFrame };
}
