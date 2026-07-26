/** 呼吸の切り替わりを触覚で伝える。iOS Safari は未対応なので、あくまで補助 */


export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function vibrate(pattern: number | number[]): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 端末が拒否した場合 */
  }
}

export const haptics = {
  /** 吸い始め・吐き始め */
  phase: () => vibrate(18),
  /** 息を止める区間の始まり */
  hold: () => vibrate([10, 60, 10]),
  /** セッションの開始・終了 */
  bookend: () => vibrate([28, 90, 28]),
  tap: () => vibrate(8),
};
