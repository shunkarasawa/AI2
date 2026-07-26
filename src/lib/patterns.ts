export type PhaseKind = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';

export interface Phase {
  kind: PhaseKind;
  seconds: number;
}

export interface BreathPattern {
  id: string;
  label: string;
  /** 4-7-8 のような表記 */
  rule: string;
  description: string;
  phases: Phase[];
}

export const PHASE_LABEL: Record<PhaseKind, string> = {
  inhale: '吸う',
  holdIn: '止める',
  exhale: '吐く',
  holdOut: '止める',
};

/**
 * 吐く時間を吸う時間より長くすると副交感神経が優位になりやすい、という
 * 呼吸法の一般的な考え方に沿って並べている。上から順に易しい。
 */
export const PATTERNS: readonly BreathPattern[] = [
  {
    id: 'coherent',
    label: 'コヒーレント呼吸',
    rule: '5-5',
    description: '1分あたり6回。いちばん基本。迷ったらこれ',
    phases: [
      { kind: 'inhale', seconds: 5 },
      { kind: 'exhale', seconds: 5 },
    ],
  },
  {
    id: 'calm',
    label: '長めに吐く',
    rule: '4-6',
    description: '吐く方を長く。気持ちを落ち着けたいとき',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'exhale', seconds: 6 },
    ],
  },
  {
    id: 'box',
    label: 'ボックス呼吸',
    rule: '4-4-4-4',
    description: '四辺を等しく。集中を戻したいとき',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'holdIn', seconds: 4 },
      { kind: 'exhale', seconds: 4 },
      { kind: 'holdOut', seconds: 4 },
    ],
  },
  {
    id: 'relax478',
    label: '4-7-8 呼吸',
    rule: '4-7-8',
    description: '息を長く止めて長く吐く。眠る前に',
    phases: [
      { kind: 'inhale', seconds: 4 },
      { kind: 'holdIn', seconds: 7 },
      { kind: 'exhale', seconds: 8 },
    ],
  },
  {
    id: 'long',
    label: '深い呼吸',
    rule: '6-10',
    description: '1分あたり約4回。慣れてきたら',
    phases: [
      { kind: 'inhale', seconds: 6 },
      { kind: 'exhale', seconds: 10 },
    ],
  },
];

export const PATTERN_BY_ID: Record<string, BreathPattern> = Object.fromEntries(
  PATTERNS.map((p) => [p.id, p]),
);

export const DEFAULT_PATTERN = PATTERNS[0] as BreathPattern;

export function getPattern(id: string): BreathPattern {
  return PATTERN_BY_ID[id] ?? DEFAULT_PATTERN;
}

export function cycleSeconds(pattern: BreathPattern): number {
  return pattern.phases.reduce((total, phase) => total + phase.seconds, 0);
}

/** 1分あたりの呼吸回数 */
export function breathsPerMinute(pattern: BreathPattern): number {
  return 60 / cycleSeconds(pattern);
}
