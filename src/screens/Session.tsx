import { useCallback, useEffect, useRef } from 'react';
import { BreathOrb } from '../components/BreathOrb';
import { IconClose, IconPause, IconPlay, IconStop } from '../components/icons';
import type { useSession } from '../hooks/useSession';
import { getPattern } from '../lib/patterns';
import { isWorthRecording, type SessionConfig, type Settings } from '../lib/storage';
import { formatClock, formatMinutes } from '../lib/time';

type Engine = ReturnType<typeof useSession>;

interface Props {
  config: SessionConfig;
  settings: Settings;
  engine: Engine;
  onClose: () => void;
}

export function Session({ config, settings, engine, onClose }: Props) {
  const { state, coarse } = engine;
  const finished = state === 'finished';
  const root = useRef<HTMLDivElement>(null);

  // 開いた瞬間、フォーカスは背後の「はじめる」に残っている。
  // 読み上げ環境にも「セッション中」を伝えるため、器自体に移す。
  // 終了画面は「とじる」に autoFocus させたいので、ここでは触らない
  useEffect(() => {
    if (!finished) root.current?.focus();
  }, [finished]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (finished) onClose();
      else engine.stop();
    },
    [engine, finished, onClose],
  );

  if (finished) {
    const completed = engine.lastCompleted;
    return (
      <div
        className="session"
        role="dialog"
        aria-modal="true"
        aria-label="セッションの結果"
        ref={root}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="session-stage">
          {/* 最も伝えたい結果なので、読み上げ環境にも届くようにする */}
          <div className="done" role="status">
            <div className="done-title">
              {completed ? 'おつかれさまでした' : 'ここまでにしました'}
            </div>
            <div className="done-time">{formatClock(coarse.elapsed)}</div>
            <p className="done-note">
              {completed
                ? '記録しました。うまくできたかどうかは、気にしなくていいものです。'
                : isWorthRecording(coarse.elapsed)
                  ? '座った分は記録しました。'
                  : '短すぎたので記録には残していません。'}
            </p>
          </div>
        </div>
        <div className="session-bottom">
          <button type="button" className="primary" onClick={onClose} autoFocus>
            とじる
          </button>
        </div>
      </div>
    );
  }

  const paused = state === 'paused';

  return (
    <div
      className="session"
      role="dialog"
      aria-modal="true"
      aria-label="セッション中"
      ref={root}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="session-top">
        <button
          type="button"
          className="icon-btn"
          aria-label="セッションをやめる"
          onClick={engine.stop}
        >
          <IconClose />
        </button>
        <span className="session-meta">
          {config.mode === 'breath' ? getPattern(config.patternId).label : '静かに座る'} ·{' '}
          {formatMinutes(config.durationSec / 60)}
        </span>
        <span className="session-meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
          残り {formatClock(coarse.remaining)}
        </span>
      </div>

      <div className="session-stage">
        <BreathOrb
          mode={config.mode}
          phase={coarse.phase}
          countdown={coarse.phaseCountdown}
          remaining={coarse.remaining}
          showCountdown={settings.showCountdown}
          paused={paused}
          register={engine.onFrame}
        />
      </div>

      <div className="session-bottom">
        {/* key を分けて要素の同一性を切る。同じ位置のボタンを差し替えると
            React が DOM を再利用し、フォーカスが「やめる」に移ってしまう */}
        <div className="session-controls">
          {paused ? (
            <>
              <button
                key="stop"
                type="button"
                className="round-btn small"
                aria-label="やめる"
                onClick={engine.stop}
              >
                <IconStop />
              </button>
              <button
                key="resume"
                type="button"
                className="round-btn"
                aria-label="つづける"
                onClick={engine.resume}
                autoFocus
              >
                <IconPlay />
              </button>
            </>
          ) : (
            <button
              key="pause"
              type="button"
              className="round-btn"
              aria-label="一時停止"
              onClick={engine.pause}
              autoFocus
            >
              <IconPause />
            </button>
          )}
        </div>
        {config.mode === 'breath' && coarse.cycles > 0 ? (
          <span className="orb-hint">{coarse.cycles} 呼吸</span>
        ) : null}
      </div>
    </div>
  );
}
