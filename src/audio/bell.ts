/**
 * ベル（シンギングボウル / ゴング / チャイム）の加算合成。
 *
 * 金属の打楽器は倍音が整数比にならない。この非整数比（inharmonicity）が
 * 「金属の響き」の正体なので、比率はあえて 2.41 / 3.85 のような値にしている。
 * さらに各パーシャルを ±0.5Hz 程度ずらした 2 本で鳴らすと、
 * うなり（beating）が生まれて実際のボウルのような揺れになる。
 */

import { disconnectLater, getAudio } from './context';
import { noiseSource } from './noise';

export type BellTone = 'bowl' | 'gong' | 'chime';

interface Partial {
  /** 基音に対する周波数比 */
  ratio: number;
  gain: number;
  /** このパーシャルが消えるまでの秒数 */
  decay: number;
}

interface BellSpec {
  base: number;
  partials: Partial[];
  /** うなりの量（Hz） */
  beat: number;
  /** 撥のアタック音の強さ */
  strike: number;
  trim: number;
}

const SPECS: Record<BellTone, BellSpec> = {
  // 開始の合図。澄んだシンギングボウル
  bowl: {
    base: 293.7,
    partials: [
      { ratio: 1, gain: 1, decay: 7.5 },
      { ratio: 2.41, gain: 0.42, decay: 5.4 },
      { ratio: 3.85, gain: 0.2, decay: 3.8 },
      { ratio: 5.32, gain: 0.1, decay: 2.6 },
      { ratio: 6.94, gain: 0.05, decay: 1.8 },
    ],
    beat: 0.55,
    strike: 0.1,
    trim: 0.5,
  },
  // 終了の合図。深く長く沈む
  gong: {
    base: 146.8,
    partials: [
      { ratio: 1, gain: 1, decay: 10 },
      { ratio: 1.52, gain: 0.5, decay: 8 },
      { ratio: 2.44, gain: 0.34, decay: 6.5 },
      { ratio: 3.44, gain: 0.18, decay: 5 },
      { ratio: 4.6, gain: 0.09, decay: 3.4 },
      { ratio: 6.1, gain: 0.04, decay: 2.2 },
    ],
    beat: 0.35,
    strike: 0.14,
    trim: 0.55,
  },
  // 途中の区切り。短く控えめ
  chime: {
    base: 587.3,
    partials: [
      { ratio: 1, gain: 1, decay: 2.8 },
      { ratio: 2.76, gain: 0.28, decay: 1.9 },
      { ratio: 5.4, gain: 0.1, decay: 1.2 },
    ],
    beat: 0.7,
    strike: 0.06,
    trim: 0.34,
  },
};

/** ベルを鳴らす。戻り値は響きが終わる時刻（AudioContext 時間） */
export function playBell(tone: BellTone, volume: number, at?: number): number {
  // 壊れた設定が入っていても例外で呼び出し元を止めない
  // （AudioParam に NaN を渡すと TypeError になる）
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  const { ctx, master } = getAudio();
  const spec = SPECS[tone];
  const t0 = at ?? ctx.currentTime + 0.02;

  const out = ctx.createGain();
  out.gain.value = volume * spec.trim;
  // 高い成分を少し削って耳に刺さらないようにする
  const tame = ctx.createBiquadFilter();
  tame.type = 'lowpass';
  tame.frequency.value = 6200;
  tame.Q.value = 0.4;
  out.connect(tame);
  tame.connect(master);

  const nodes: AudioNode[] = [out, tame];
  let longest = 0;

  for (const partial of spec.partials) {
    const freq = spec.base * partial.ratio;
    if (freq > 16000) continue;
    longest = Math.max(longest, partial.decay);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(partial.gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + partial.decay);
    env.connect(out);
    nodes.push(env);

    // うなりを作るための 2 本
    for (const detune of [-spec.beat / 2, spec.beat / 2]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq + detune;
      osc.connect(env);
      osc.start(t0);
      osc.stop(t0 + partial.decay + 0.05);
      nodes.push(osc);
    }
  }

  if (spec.strike > 0) {
    const noise = noiseSource(ctx, 'white');
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = spec.base * 5;
    band.Q.value = 1.2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(spec.strike, t0 + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    noise.connect(band);
    band.connect(env);
    env.connect(out);
    noise.start(t0);
    noise.stop(t0 + 0.2);
    nodes.push(noise, band, env);
  }

  const end = t0 + longest + 0.1;
  disconnectLater(nodes, end);
  return end;
}
