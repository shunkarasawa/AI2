import { useEffect, useRef } from 'react';
import { orbScale, type Frame } from '../hooks/useSession';
import { PHASE_LABEL, type PhaseKind } from '../lib/patterns';
import type { SessionMode } from '../lib/storage';
import { formatClock } from '../lib/time';

const R = 48;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface Props {
  mode: SessionMode;
  phase: PhaseKind | null;
  countdown: number;
  remaining: number;
  showCountdown: boolean;
  paused: boolean;
  /** useSession の onFrame。毎フレームの値は state を通さず直接 DOM に書く */
  register: (cb: ((frame: Frame) => void) | null) => void;
}

/**
 * 呼吸の円と、その下の読み取り部分。
 *
 * 文字を円の中に置かないのは、円が伸縮するせいで文字の背景が
 * 「濃い円の上」と「暗い背景の上」を行き来してしまい、
 * どちらでも読める文字色が存在しないため。円の外に出せば常に十分な明度差が取れる。
 */
export function BreathOrb({
  mode,
  phase,
  countdown,
  remaining,
  showCountdown,
  paused,
  register,
}: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const silent = mode === 'silent';

  useEffect(() => {
    register((frame) => {
      if (!silent) {
        stage.current?.style.setProperty('--orb-scale', orbScale(frame.openness).toFixed(4));
      }
      if (ring.current) {
        ring.current.style.strokeDashoffset = (CIRCUMFERENCE * (1 - frame.progress)).toFixed(2);
      }
    });
    return () => register(null);
  }, [register, silent]);

  return (
    <div className="orb-wrap">
      <div className="orb-stage" ref={stage}>
        <svg className="orb-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="track" cx="50" cy="50" r={R} />
          <circle
            className="value"
            cx="50"
            cy="50"
            r={R}
            ref={ring}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
        </svg>

        <div className={silent ? 'orb-glow silent' : 'orb-glow'} />
        <div className={silent ? 'orb-core silent' : 'orb-core'} />

        {paused ? <div className="paused-veil">一時停止中</div> : null}
      </div>

      <div className="orb-readout">
        {silent ? (
          <>
            <span className="orb-clock">{formatClock(remaining)}</span>
            <span className="orb-hint">静かに座る</span>
          </>
        ) : (
          <>
            <span className="orb-phase">{phase ? PHASE_LABEL[phase] : ''}</span>
            <span className="orb-count">{showCountdown && countdown > 0 ? countdown : ''}</span>
          </>
        )}
      </div>

      {/* 音を切っていても、読み上げでは区間の変化が伝わるように */}
      <span className="visually-hidden" aria-live="polite">
        {silent ? `残り ${formatClock(remaining)}` : phase ? PHASE_LABEL[phase] : ''}
      </span>
    </div>
  );
}
