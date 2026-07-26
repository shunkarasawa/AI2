import { BreathOrb } from '../components/BreathOrb';
import { IconClose, IconPause, IconPlay, IconStop } from '../components/icons';
import type { useSession } from '../hooks/useSession';
import { getPattern } from '../lib/patterns';
import type { SessionConfig, Settings } from '../lib/storage';
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

  if (finished) {
    const completed = engine.lastCompleted;
    return (
      <div className="session">
        <div className="session-stage">
          <div className="done">
            <div className="done-title">{completed ? 'おつかれさまでした' : 'ここまでにしました'}</div>
            <div className="done-time">{formatClock(coarse.elapsed)}</div>
            <p className="done-note">
              {completed
                ? '記録しました。うまくできたかどうかは、気にしなくていいものです。'
                : coarse.elapsed >= 30
                  ? '座った分は記録しました。'
                  : '短すぎたので記録には残していません。'}
            </p>
          </div>
        </div>
        <div className="session-bottom">
          <button type="button" className="primary" onClick={onClose}>
            とじる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session">
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
          paused={state === 'paused'}
          register={engine.onFrame}
        />
      </div>

      <div className="session-bottom">
        <div className="session-controls">
          {state === 'paused' ? (
            <>
              <button
                type="button"
                className="round-btn small"
                aria-label="やめる"
                onClick={engine.stop}
              >
                <IconStop />
              </button>
              <button type="button" className="round-btn" aria-label="つづける" onClick={engine.resume}>
                <IconPlay />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="round-btn"
              aria-label="一時停止"
              onClick={engine.pause}
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
