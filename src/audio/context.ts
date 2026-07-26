/**
 * 単一の AudioContext を全体で共有する。
 * モバイルではユーザー操作の中でしか生成・再開できないため、
 * 生成は必ず「再生ボタンが押された瞬間」から呼ばれる unlock() 経由にする。
 */

type WebkitWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export interface Audio {
  ctx: AudioContext;
  master: GainNode;
}

export function getAudio(): Audio {
  if (!ctx || !master) {
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio API is unavailable');
    ctx = new Ctor({ latencyHint: 'playback' });
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  return { ctx, master };
}

/**
 * iOS / Android のオートプレイ制限を解除する。
 * resume() だけでは無音のままになる端末があるので、1 サンプルの無音を実際に鳴らす。
 */
export async function unlockAudio(): Promise<Audio> {
  const audio = getAudio();
  if (audio.ctx.state !== 'running') {
    try {
      await audio.ctx.resume();
    } catch {
      /* ユーザー操作外から呼ばれた場合。次の操作で再試行される */
    }
  }
  const buffer = audio.ctx.createBuffer(1, 1, audio.ctx.sampleRate);
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(audio.master);
  src.start(0);
  return audio;
}

export function isAudioRunning(): boolean {
  return ctx?.state === 'running';
}

/** ノードを安全に切り離す（既に停止済みでも例外を投げない） */
export function disconnectLater(nodes: AudioNode[], at: number): void {
  const { ctx: c } = getAudio();
  const delay = Math.max(0, at - c.currentTime) * 1000 + 120;
  window.setTimeout(() => {
    for (const node of nodes) {
      try {
        node.disconnect();
      } catch {
        /* 既に切断済み */
      }
    }
  }, delay);
}
