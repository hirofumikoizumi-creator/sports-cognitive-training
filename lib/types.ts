// ===== 基本型 =====

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; timeLimit: number }> = {
  beginner: { label: '初級', timeLimit: 3000 },
  intermediate: { label: '中級', timeLimit: 2000 },
  advanced: { label: '上級', timeLimit: 1000 },
  elite: { label: 'エリート', timeLimit: 700 },
};

export type TrainingLevel = 'level1' | 'level2' | 'level3' | 'level4';

export const LEVEL_CONFIG: Record<TrainingLevel, { label: string; description: string }> = {
  level1: { label: 'レベル1', description: '方向認識' },
  level2: { label: 'レベル2', description: '数字認識' },
  level3: { label: 'レベル3', description: '色認識' },
  level4: { label: 'レベル4', description: '複合認識' },
};

export type Direction = 'forward' | 'back' | 'left' | 'right';

export const DIRECTION_LABELS: Record<Direction, string> = {
  forward: '前',
  back: '後',
  left: '左',
  right: '右',
};

export type ColorName = 'red' | 'blue' | 'yellow' | 'green';

export const COLOR_LABELS: Record<ColorName, string> = {
  red: '赤',
  blue: '青',
  yellow: '黄',
  green: '緑',
};

export const COLOR_HEX: Record<ColorName, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  yellow: '#FBBF24',
  green: '#10B981',
};

export type JudgeResult = 'success' | 'fail' | 'timeout';

// ===== レベル1: 方向認識 =====

export interface Level1Question {
  type: 'level1';
  direction: Direction;
  displayText: string; // "前" | "後" | "左" | "右"
}

// ===== レベル2: 数字認識 =====

export interface Level2Question {
  type: 'level2';
  number: 1 | 2 | 3 | 4;
  mapping: Record<1 | 2 | 3 | 4, Direction>; // セッション共通
  correctDirection: Direction;
}

// ===== レベル3: 色認識 =====

export interface Level3Question {
  type: 'level3';
  color: ColorName;
  mapping: Record<ColorName, Direction>; // セッション共通
  correctDirection: Direction;
  colorHex: string;
}

// ===== レベル4: 複合認識 =====

export type Level4Question = Level1Question | Level2Question | Level3Question;

// ===== 統合型 =====

export type TrainingQuestion = Level1Question | Level2Question | Level3Question | Level4Question;

// ===== トレーニング結果 =====

export interface TrainingResult {
  id: string;
  level: TrainingLevel;
  difficulty: Difficulty;
  date: string;
  totalScore: number;
  successCount: number;
  failCount: number;
  timeoutCount: number;
  successRate: number;
  avgReactionTime: number;
  maxCombo: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  totalQuestions: number;
  durationMs: number;
  timestamp: number;
}

// ===== 設定 =====

export interface AppSettings {
  voiceEnabled: boolean;
  darkMode: boolean;
  onboardingDone: boolean;
}

// ===== ポーズ関連 =====

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type PoseLandmarks = PoseLandmark[];

export interface PoseSnapshot {
  landmarks: PoseLandmarks;
  timestamp: number;
}

// ===== 統計 =====

export interface Stats {
  bestScore: number;
  totalPlays: number;
  totalDurationMs: number;
  averageScore: number;
  successRateOverall: number;
}
