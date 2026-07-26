/**
 * 環境音。すべてノイズとフィルタからリアルタイム合成する。
 *
 * 音源ファイルを使わない理由:
 *   - 著作権の心配がない
 *   - バンドルが軽く、オフラインで完全に動く
 *   - ループの継ぎ目がないので、何十分でも自然に鳴り続ける
 *
 * 作り方の考え方は「ノイズをフィルタで削って、ゆっくり揺らす」。
 * 揺らぎ（LFO）の周期は互いに素にして、規則性が耳につかないようにしている。
 */

import { getAudio } from './context';
import { noiseSource, SEAM_SECONDS } from './noise';

export type AmbientId = 'rain' | 'ocean' | 'stream' | 'forestNight' | 'white' | 'brown' | 'drone';

export interface AmbientDef {
  id: AmbientId;
  label: string;
  description: string;
  /** テクスチャごとの音量差をならすための係数 */
  trim: number;
}

export const AMBIENTS: readonly AmbientDef[] = [
  { id: 'rain', label: '雨', description: '窓の外の静かな雨', trim: 0.5 },
  { id: 'ocean', label: '波', description: 'ゆっくり寄せて返す波', trim: 0.62 },
  { id: 'stream', label: '小川', description: '浅い川のせせらぎ', trim: 0.85 },
  { id: 'forestNight', label: '夜の森', description: '虫の音と遠い風', trim: 0.5 },
  { id: 'white', label: 'ホワイトノイズ', description: '生活音を覆い隠す', trim: 0.22 },
  { id: 'brown', label: 'ブラウンノイズ', description: '低くやわらかい持続音', trim: 0.5 },
  { id: 'drone', label: 'ドローン', description: 'ボウルの持続音', trim: 0.34 },
];

export const AMBIENT_BY_ID: Record<AmbientId, AmbientDef> = Object.fromEntries(
  AMBIENTS.map((a) => [a.id, a]),
) as Record<AmbientId, AmbientDef>;

export interface AmbientHandle {
  id: AmbientId;
  setVolume(volume: number, ramp?: number): void;
  stop(fade?: number): void;
}

type Source = AudioBufferSourceNode | OscillatorNode;

export interface Build {
  nodes: AudioNode[];
  sources: Source[];
  /**
   * 時間軸上に音を撒くテクスチャ（泡など）はグラフだけでは表現できない。
   * [from, to) の区間ぶんを予約する関数を置き、再生側が先読みして呼ぶ。
   * オフラインレンダリングでは全区間を一度に呼べる。
   */
  tick?: (from: number, to: number) => void;
}

const FADE_IN = 2;
const FADE_OUT = 1.4;
/** 泡の予約をどれだけ先まで入れておくか。裏に回ってタイマーが間引かれても途切れない長さ */
const SCHEDULE_HORIZON = 2;
const SCHEDULE_INTERVAL_MS = 500;

/** グラフの組み立てだけを行う。ctx を渡せるのでオフラインでも同じ音を作れる */
export function buildAmbient(ctx: AudioContext, id: AmbientId, destination: AudioNode): Build {
  return BUILDERS[id](ctx, destination);
}

export function startAmbient(id: AmbientId, volume: number): AmbientHandle {
  const { ctx, master } = getAudio();
  const def = AMBIENT_BY_ID[id];

  const bus = ctx.createGain();
  const target = volume * def.trim;
  bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  bus.gain.linearRampToValueAtTime(target, ctx.currentTime + FADE_IN);
  bus.connect(master);

  const build = buildAmbient(ctx, id, bus);
  // 同じノイズバッファを共有しているので、開始位置をずらさないと
  // レイヤーどうしが完全に相関する（小川の2層が同じ音、虫が3匹とも同期する）。
  // 位置をずらせば毎回わずかに違う音になり、ループの周期も揃わなくなる
  for (const src of build.sources) {
    if (src instanceof AudioBufferSourceNode && src.buffer) {
      const span = src.buffer.duration - SEAM_SECONDS;
      src.start(0, SEAM_SECONDS + Math.random() * Math.max(0, span));
    } else {
      src.start();
    }
  }

  let stopped = false;

  // 時間軸に音を撒くテクスチャは、先読みして少しずつ予約する。
  // AudioContext の時計で予約するので、タイマーの精度に影響されない
  let scheduled = ctx.currentTime;
  let timer: number | null = null;
  if (build.tick) {
    const pump = () => {
      if (stopped) return;
      const horizon = ctx.currentTime + SCHEDULE_HORIZON;
      if (horizon > scheduled) {
        build.tick?.(Math.max(scheduled, ctx.currentTime), horizon);
        scheduled = horizon;
      }
    };
    pump();
    timer = window.setInterval(pump, SCHEDULE_INTERVAL_MS);
  }

  return {
    id,
    setVolume(next, ramp = 0.25) {
      if (stopped) return;
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
      bus.gain.linearRampToValueAtTime(Math.max(0.0001, next * def.trim), now + ramp);
    },
    stop(fade = FADE_OUT) {
      if (stopped) return;
      stopped = true;
      if (timer !== null) window.clearInterval(timer);
      const now = ctx.currentTime;
      const end = now + fade;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
      bus.gain.exponentialRampToValueAtTime(0.0001, end);
      for (const src of build.sources) {
        try {
          src.stop(end + 0.05);
        } catch {
          /* 既に停止済み */
        }
      }
      window.setTimeout(
        () => {
          for (const node of [...build.nodes, bus]) {
            try {
              node.disconnect();
            } catch {
              /* 既に切断済み */
            }
          }
        },
        (fade + 0.3) * 1000,
      );
    },
  };
}

// ---------------------------------------------------------------- 部品

function filter(
  ctx: AudioContext,
  type: BiquadFilterType,
  frequency: number,
  q = 0.7,
): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

function gain(ctx: AudioContext, value: number): GainNode {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

/**
 * 位相をずらした正弦波。
 * sin(2πt + φ) = cos(φ)·sin(2πt) + sin(φ)·cos(2πt) を
 * PeriodicWave の imag/real 係数に割り当てる。
 * OscillatorNode は位相を指定できないので、こうしないと
 * すべての LFO が毎回まったく同じところから始まってしまう。
 */
function phasedSine(ctx: AudioContext, phase: number): PeriodicWave {
  const real = new Float32Array([0, Math.sin(phase)]);
  const imag = new Float32Array([0, Math.cos(phase)]);
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
}

/** AudioParam をゆっくり揺らす。base を中心に ±depth */
function modulate(
  ctx: AudioContext,
  param: AudioParam,
  base: number,
  depth: number,
  rate: number,
  build: Build,
): void {
  param.value = base;
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(phasedSine(ctx, Math.random() * Math.PI * 2));
  osc.frequency.value = rate;
  const amount = gain(ctx, depth);
  osc.connect(amount);
  amount.connect(param);
  build.sources.push(osc);
  build.nodes.push(osc, amount);
}

function chain(build: Build, nodes: AudioNode[], destination: AudioNode): void {
  nodes.forEach((node, i) => {
    const next = nodes[i + 1] ?? destination;
    node.connect(next);
  });
  build.nodes.push(...nodes);
}

/**
 * 泡がひとつ弾ける音。
 *
 * 水中の気泡は減衰する正弦波を放射し、しぼむにつれて共振周波数が上がる
 * （van den Doel の気泡モデル）。この「短く鳴って音程が上がる」性質が
 * せせらぎの正体で、ノイズをフィルタで削るだけでは絶対に出てこない。
 * 帯域だけを変えたノイズは、どう転んでも雨と同じ質感になる。
 *
 *   f(t) = f0 · (1 + ξ·d·t)      a(t) = a0 · e^(−d·t)
 *   d = 0.043·f0 + 0.0014·f0^1.5   （半径から決まる減衰係数）
 */
function bubble(ctx: AudioContext, dest: AudioNode, at: number, f0: number, level: number): void {
  const damping = 0.043 * f0 + 0.0014 * f0 ** 1.5;
  const duration = Math.min(0.16, 4 / damping);
  const rise = 1 + 0.1 * damping * duration;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, at);
  osc.frequency.linearRampToValueAtTime(f0 * rise, at + duration);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(level, at + 0.0012);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(env);
  env.connect(dest);
  osc.start(at);
  osc.stop(at + duration + 0.01);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}

/** 指数分布の待ち時間で泡を撒く（等間隔だと機械的に聞こえる） */
function scheduleBubbles(
  ctx: AudioContext,
  dest: AudioNode,
  from: number,
  to: number,
  perSecond: number,
  pick: () => { f0: number; level: number },
): void {
  let t = from + -Math.log(1 - Math.random()) / perSecond;
  while (t < to) {
    const { f0, level } = pick();
    bubble(ctx, dest, t, f0, level);
    t += -Math.log(1 - Math.random()) / perSecond;
  }
}

function noise(ctx: AudioContext, color: 'white' | 'pink' | 'brown', build: Build) {
  const src = noiseSource(ctx, color);
  build.sources.push(src);
  build.nodes.push(src);
  return src;
}

// ---------------------------------------------------------------- テクスチャ

type Builder = (ctx: AudioContext, out: AudioNode) => Build;

const BUILDERS: Record<AmbientId, Builder> = {
  rain(ctx, out) {
    const build: Build = { nodes: [], sources: [] };

    // 細かい雨音。帯域の中心をゆっくり動かして「降り方が変わる」感じを出す
    const hiss = noise(ctx, 'white', build);
    const hissHigh = filter(ctx, 'highpass', 900, 0.6);
    const hissLow = filter(ctx, 'lowpass', 7000, 0.5);
    const hissGain = gain(ctx, 0.5);
    modulate(ctx, hissLow.frequency, 6800, 1600, 0.037, build);
    modulate(ctx, hissGain.gain, 0.5, 0.12, 0.019, build);
    chain(build, [hiss, hissHigh, hissLow, hissGain], out);

    // 中域の雨粒
    const body = noise(ctx, 'pink', build);
    const bodyBand = filter(ctx, 'bandpass', 1500, 0.55);
    const bodyGain = gain(ctx, 0.45);
    modulate(ctx, bodyGain.gain, 0.45, 0.15, 0.011, build);
    chain(build, [body, bodyBand, bodyGain], out);

    // 遠くの雨のうなり
    const rumble = noise(ctx, 'brown', build);
    const rumbleLow = filter(ctx, 'lowpass', 240, 0.7);
    const rumbleGain = gain(ctx, 0.3);
    chain(build, [rumble, rumbleLow, rumbleGain], out);

    return build;
  },

  ocean(ctx, out) {
    const build: Build = { nodes: [], sources: [] };
    // 18 秒くらいで寄せて返す
    const waveRate = 1 / 18;

    const swell = noise(ctx, 'brown', build);
    const swellLow = filter(ctx, 'lowpass', 420, 0.9);
    const swellGain = gain(ctx, 0.6);
    modulate(ctx, swellLow.frequency, 420, 190, waveRate, build);
    modulate(ctx, swellGain.gain, 0.6, 0.4, waveRate, build);
    chain(build, [swell, swellLow, swellGain], out);

    // 砕けるときの泡。うねりとわずかに違う周期にしてズレさせる
    const foam = noise(ctx, 'white', build);
    const foamHigh = filter(ctx, 'highpass', 1800, 0.5);
    const foamGain = gain(ctx, 0.16);
    modulate(ctx, foamGain.gain, 0.16, 0.15, waveRate * 1.06, build);
    chain(build, [foam, foamHigh, foamGain], out);

    return build;
  },

  stream(ctx, out) {
    const build: Build = { nodes: [], sources: [] };

    // 水の厚み。雨より低い帯域に寄せる。
    // 雨の識別点は 1〜7kHz の広いシャー音なので、そこを薄くしないと区別がつかない
    const flow = noise(ctx, 'pink', build);
    const flowBand = filter(ctx, 'bandpass', 700, 1.1);
    const flowGain = gain(ctx, 0.45);
    modulate(ctx, flowGain.gain, 0.45, 0.1, 0.053, build);
    chain(build, [flow, flowBand, flowGain], out);

    // 流れの擦れ。雨と被らないよう中域に絞り、量も控えめにする
    const rush = noise(ctx, 'white', build);
    const rushBand = filter(ctx, 'bandpass', 1900, 0.7);
    const rushGain = gain(ctx, 0.22);
    modulate(ctx, rushBand.frequency, 1900, 450, 0.09, build);
    chain(build, [rush, rushBand, rushGain], out);

    // ここがせせらぎの正体。細かい泡を絶えず、大きい泡をときどき。
    // 泡はノイズの寝床に埋もれると意味がないので等倍で通し、寝床の方を抑えている。
    // 実測: 泡ありで離散音 13.7回/秒・クレストファクタ 9.1、
    //       雨は 0回/秒・4.1（＝雨は連続、小川は粒立つ、という差が数値でも出る）
    const bubbles = gain(ctx, 1);
    const bubbleTone = filter(ctx, 'lowpass', 4200, 0.6);
    chain(build, [bubbles, bubbleTone], out);

    build.tick = (from, to) => {
      scheduleBubbles(ctx, bubbles, from, to, 22, () => {
        // 半径は対数一様に散らす（小さい泡ほど多い、という感じになる）
        const f0 = 620 * 4.4 ** Math.random();
        return { f0, level: 0.52 * (800 / f0) ** 0.6 };
      });
      // ときおり水がくぐもる低い泡
      scheduleBubbles(ctx, bubbles, from, to, 1.6, () => {
        const f0 = 260 + Math.random() * 220;
        return { f0, level: 0.7 };
      });
    };

    return build;
  },

  forestNight(ctx, out) {
    const build: Build = { nodes: [], sources: [] };

    // 虫の音。狭い帯域のノイズを細かく振幅変調すると鈴虫のような音になる
    for (const [center, rate, level] of [
      [4600, 11, 0.09],
      [5400, 7.3, 0.06],
      [3900, 15.7, 0.05],
    ] as const) {
      const bug = noise(ctx, 'white', build);
      const band = filter(ctx, 'bandpass', center, 14);
      const chirp = gain(ctx, level);
      modulate(ctx, chirp.gain, level, level * 0.95, rate, build);
      // 鳴き始め・鳴き終わりのゆらぎ
      const swell = gain(ctx, 0.7);
      modulate(ctx, swell.gain, 0.6, 0.4, 0.023 + center / 400000, build);
      chain(build, [bug, band, chirp, swell], out);
    }

    // 遠くの風
    const wind = noise(ctx, 'brown', build);
    const windLow = filter(ctx, 'lowpass', 300, 0.8);
    const windGain = gain(ctx, 0.34);
    modulate(ctx, windLow.frequency, 300, 140, 0.031, build);
    modulate(ctx, windGain.gain, 0.34, 0.2, 0.017, build);
    chain(build, [wind, windLow, windGain], out);

    return build;
  },

  white(ctx, out) {
    const build: Build = { nodes: [], sources: [] };
    const src = noise(ctx, 'white', build);
    // そのままだと刺さるので上を少し落とす
    chain(build, [src, filter(ctx, 'lowpass', 11000, 0.5), gain(ctx, 0.9)], out);
    return build;
  },

  brown(ctx, out) {
    const build: Build = { nodes: [], sources: [] };
    const src = noise(ctx, 'brown', build);
    chain(build, [src, filter(ctx, 'lowpass', 900, 0.6), gain(ctx, 0.9)], out);
    return build;
  },

  drone(ctx, out) {
    const build: Build = { nodes: [], sources: [] };
    const base = 110; // A2
    const tone = filter(ctx, 'lowpass', 1300, 0.6);
    const tremolo = gain(ctx, 0.8);
    modulate(ctx, tremolo.gain, 0.78, 0.18, 0.062, build);
    chain(build, [tone, tremolo], out);

    for (const [ratio, level, type] of [
      [1, 0.5, 'triangle'],
      [1.5, 0.3, 'sine'],
      [2, 0.2, 'sine'],
      [3, 0.08, 'sine'],
      [4.5, 0.04, 'sine'],
    ] as const) {
      const level_ = gain(ctx, level);
      level_.connect(tone);
      build.nodes.push(level_);
      // 2 本をわずかにずらしてうなりを作る
      for (const cents of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = base * ratio;
        osc.detune.value = cents;
        osc.connect(level_);
        build.sources.push(osc);
        build.nodes.push(osc);
      }
    }

    return build;
  },
};
