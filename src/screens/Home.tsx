import { useEffect, useRef, useState } from 'react';
import { AMBIENTS, startAmbient, type AmbientHandle, type AmbientId } from '../audio/ambient';
import { playBell } from '../audio/bell';
import { unlockAudio } from '../audio/context';
import { IconFlame, IconMute, IconPlay, IconSpeaker } from '../components/icons';
import { Section, Segmented, SwitchRow } from '../components/ui';
import { breathsPerMinute, cycleSeconds, getPattern, PATTERNS } from '../lib/patterns';
import type { Summary } from '../lib/stats';
import { BELL_TONES, type SessionConfig, type SessionMode, type Settings } from '../lib/storage';
import { formatMinutes } from '../lib/time';

const DURATIONS = [1, 3, 5, 10, 15, 20, 30, 45, 60];
const INTERVALS = [0, 1, 2, 5, 10];
/** 試聴は放置されても止まるようにする */
const PREVIEW_MS = 20_000;

interface Props {
  config: SessionConfig;
  settings: Settings;
  summary: Summary;
  onConfig: (patch: Partial<SessionConfig>) => void;
  onStart: () => void;
}

export function Home({ config, settings, summary, onConfig, onStart }: Props) {
  const preview = useRef<AmbientHandle | null>(null);
  const previewTimer = useRef<number | null>(null);
  /** await をまたぐ間に別の音が選ばれたかを見るための世代番号 */
  const previewGen = useRef(0);
  const [previewing, setPreviewing] = useState<AmbientId | null>(null);

  const stopPreview = () => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    previewTimer.current = null;
    preview.current?.stop(0.4);
    preview.current = null;
    setPreviewing(null);
  };

  useEffect(() => stopPreview, []);

  const togglePreview = async (id: AmbientId) => {
    // unlockAudio を待つ間に別のボタンが押されると、
    // 先に始まった方のハンドルが上書きされて誰も止められなくなる
    const generation = ++previewGen.current;
    const wasPlaying = previewing === id;
    stopPreview();
    if (wasPlaying) return;

    await unlockAudio();
    if (generation !== previewGen.current) return;

    preview.current = startAmbient(id, settings.ambientVolume);
    setPreviewing(id);
    previewTimer.current = window.setTimeout(stopPreview, PREVIEW_MS);
  };

  const pattern = getPattern(config.patternId);
  const breaths = Math.round(config.durationSec / cycleSeconds(pattern));

  const start = () => {
    stopPreview();
    onStart();
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">{greeting()}</h1>
        <p className="page-sub">
          {summary.sessions === 0
            ? 'まず3分だけ座ってみましょう。うまくやる必要はありません。'
            : '今日のぶんを、いまから。'}
        </p>
      </header>

      <div className="hero">
        <div className="hero-flame">
          <IconFlame />
        </div>
        <div className="hero-main">
          <div className="hero-title">
            {summary.currentStreak > 0 ? `${summary.currentStreak}日 続いています` : 'これから始めます'}
          </div>
          <div className="hero-sub">
            {summary.sessions === 0
              ? '記録はこの端末の中だけに保存されます'
              : `通算 ${summary.sessions}回 · ${formatMinutes(summary.minutes)}`}
          </div>
        </div>
      </div>

      <Section title="やりかた">
        <Segmented<SessionMode>
          label="セッションの種類"
          value={config.mode}
          onChange={(mode) => onConfig({ mode })}
          options={[
            { value: 'breath', label: '呼吸ガイド' },
            { value: 'silent', label: '静かに座る' },
          ]}
        />
      </Section>

      {config.mode === 'breath' ? (
        <Section title="呼吸のリズム" note={`1分に約${Math.round(breathsPerMinute(pattern))}回`}>
          <div className="option-list" role="group" aria-label="呼吸のリズム">
            {PATTERNS.map((item) => (
              <button
                type="button"
                key={item.id}
                className="option"
                aria-pressed={item.id === config.patternId}
                onClick={() => onConfig({ patternId: item.id })}
              >
                <div className="option-body">
                  <div className="option-title">
                    {item.label}
                    <span className="option-rule">{item.rule}</span>
                  </div>
                  <div className="option-desc">{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        title="長さ"
        note={config.mode === 'breath' ? `約${breaths}呼吸` : undefined}
      >
        <div className="duration-grid" role="group" aria-label="セッションの長さ">
          {DURATIONS.map((minutes) => (
            <button
              type="button"
              key={minutes}
              className="duration"
              aria-pressed={config.durationSec === minutes * 60}
              onClick={() =>
                onConfig({
                  durationSec: minutes * 60,
                  // 長さより長い間隔は成立しないので、選択済みでも落とす
                  ...(config.intervalBellMin * 60 >= minutes * 60 ? { intervalBellMin: 0 } : {}),
                })
              }
            >
              <span className="duration-num">{minutes}</span>
              <span className="duration-unit">分</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="環境音" note="試聴 ▸">
        <div className="option-list">
          <button
            type="button"
            className="option"
            aria-pressed={config.ambient === 'none'}
            onClick={() => {
              stopPreview();
              onConfig({ ambient: 'none' });
            }}
          >
            <div className="option-body">
              <div className="option-title">なし</div>
              <div className="option-desc">音を足さずに座る</div>
            </div>
          </button>

          {/* 選択と試聴は別のボタン。入れ子のボタンにしないため行は div にしている */}
          {AMBIENTS.map((item) => (
            <div key={item.id} className="option" data-selected={config.ambient === item.id}>
              <button
                type="button"
                className="option-hit"
                aria-pressed={config.ambient === item.id}
                onClick={() => onConfig({ ambient: item.id })}
              >
                <span className="option-title">{item.label}</span>
                <span className="option-desc">{item.description}</span>
              </button>
              <div className="option-aside">
                <button
                  type="button"
                  className="icon-btn"
                  aria-pressed={previewing === item.id}
                  aria-label={`${item.label}を試聴`}
                  onClick={() => void togglePreview(item.id)}
                >
                  {previewing === item.id ? <IconMute /> : <IconSpeaker />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ベル">
        <div className="card card-pad">
          <SwitchRow
            title="はじめに鳴らす"
            desc="ボウルの音で始まりを知らせます"
            checked={config.startBell}
            onChange={(startBell) => {
              onConfig({ startBell });
              if (startBell) void unlockAudio().then(() => playBell(BELL_TONES.start, settings.bellVolume));
            }}
          />
          <SwitchRow
            title="おわりに鳴らす"
            desc="深いゴングで終わりを知らせます"
            checked={config.endBell}
            onChange={(endBell) => {
              onConfig({ endBell });
              if (endBell) void unlockAudio().then(() => playBell(BELL_TONES.end, settings.bellVolume));
            }}
          />
          <div className="row" style={{ display: 'block' }}>
            <div className="row-title" style={{ marginBottom: '0.5rem' }}>途中のベル</div>
            <div className="chips" role="group" aria-label="途中のベルの間隔">
              {INTERVALS.map((minutes) => {
                // disabled にするとタブ順から外れ、なぜ押せないのかを読めなくなる。
                // aria-disabled ならフォーカスして理由を確認できる
                const unavailable = minutes !== 0 && minutes * 60 >= config.durationSec;
                return (
                  <button
                    type="button"
                    key={minutes}
                    className="chip"
                    aria-pressed={config.intervalBellMin === minutes}
                    aria-disabled={unavailable}
                    aria-describedby={unavailable ? 'interval-note' : undefined}
                    onClick={() => {
                      if (unavailable) return;
                      onConfig({ intervalBellMin: minutes });
                      if (minutes > 0) {
                        void unlockAudio().then(() =>
                          playBell(BELL_TONES.interval, settings.bellVolume),
                        );
                      }
                    }}
                  >
                    {minutes === 0 ? 'なし' : `${minutes}分ごと`}
                  </button>
                );
              })}
            </div>
            <p id="interval-note" className="row-desc">
              セッションの長さ以上の間隔は選べません
            </p>
          </div>
        </div>
      </Section>

      <div className="start-bar">
        <button type="button" className="primary" onClick={start}>
          <IconPlay />
          {formatMinutes(config.durationSec / 60)} はじめる
        </button>
      </div>
    </div>
  );
}

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 4) return 'こんばんは';
  if (hour < 10) return 'おはようございます';
  if (hour < 17) return 'こんにちは';
  return 'こんばんは';
}
