/**
 * ノイズ源。音源ファイルを持たずに環境音を作るための土台。
 * 生成コストがあるので AudioContext ごと・色ごとにキャッシュする。
 */

export type NoiseColor = 'white' | 'pink' | 'brown';

const LOOP_SECONDS = 8;
/**
 * ループの継ぎ目をつなぐクロスフェード長。
 * 短いと、無相関な2信号を混ぜたときのパワー低下（等パワー曲線でも -3dB）が
 * 短時間に集中して低周波の過渡になる。ブラウンノイズでは 50ms のとき
 * 最大 -9dB の落ち込みが 8秒ごとに繰り返して聞き取れたため、0.5 秒に伸ばしている。
 */
export const SEAM_SECONDS = 0.5;

const cache = new WeakMap<BaseAudioContext, Map<NoiseColor, AudioBuffer>>();

export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  let perCtx = cache.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    cache.set(ctx, perCtx);
  }
  const hit = perCtx.get(color);
  if (hit) return hit;

  const length = Math.floor(ctx.sampleRate * LOOP_SECONDS);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  fill(data, color);
  crossfadeSeam(data, Math.floor(ctx.sampleRate * SEAM_SECONDS));

  perCtx.set(color, buffer);
  return buffer;
}

function fill(data: Float32Array, color: NoiseColor): void {
  switch (color) {
    case 'white':
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return;

    case 'pink': {
      // Paul Kellet のフィルタ近似（-3dB/oct）
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      return;
    }

    case 'brown': {
      // 積分によるブラウンノイズ（-6dB/oct）。leak で DC ドリフトを抑える
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
      return;
    }
  }
}

/**
 * 末尾に先頭 seam サンプル分を重ねる。
 * これで「末尾の最後」は「先頭 seam 番目の直前」と連続になるので、
 * 再生側はループ開始位置を seam にずらす（noiseSource を参照）。
 */
function crossfadeSeam(data: Float32Array, seam: number): void {
  if (seam <= 0 || seam * 2 >= data.length) return;
  const tailStart = data.length - seam;
  for (let i = 0; i < seam; i++) {
    // 無相関な信号どうしなので、線形ではなく等パワー（cos/sin）で混ぜる。
    // 線形だと中間で -3dB より深く沈む
    const t = (i / seam) * (Math.PI / 2);
    const tail = data[tailStart + i] ?? 0;
    const head = data[i] ?? 0;
    data[tailStart + i] = tail * Math.cos(t) + head * Math.sin(t);
  }
}

export function noiseSource(ctx: BaseAudioContext, color: NoiseColor): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  const buffer = noiseBuffer(ctx, color);
  src.buffer = buffer;
  src.loop = true;
  // 2 周目以降は seam の分だけ後ろから始める。
  // 末尾はクロスフェードで seam 直前の波形になっているため、ここで繋がる
  src.loopStart = SEAM_SECONDS;
  src.loopEnd = buffer.duration;
  return src;
}
