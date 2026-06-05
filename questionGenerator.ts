import type { CognitiveTask, CognitiveType, MotionType, TrainingQuestion } from './types';

// ===== 認知課題定義 =====

const COLORS = ['赤', '青', '黄', '緑'] as const;
type Color = typeof COLORS[number];

const COLOR_MOTION_MAP: Record<Color, MotionType> = {
  赤: 'step_right',
  青: 'step_left',
  黄: 'jump',
  緑: 'squat',
};

const NUMBERS = [1, 2, 3, 4] as const;

const MOTION_LABELS: Record<MotionType, string> = {
  step_right: '右へステップ',
  step_left: '左へステップ',
  step_forward: '前へステップ',
  step_back: '後ろへステップ',
  jump: 'ジャンプ',
  squat: 'スクワット',
  turn_right: '右ターン',
  turn_left: '左ターン',
  raise_right: '右足上げ',
  raise_left: '左足上げ',
  balance: '片足立ち',
};

const ALL_MOTIONS: MotionType[] = Object.keys(MOTION_LABELS) as MotionType[];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomMotion(): MotionType {
  return randomItem(ALL_MOTIONS);
}

// ===== 認知課題生成 =====

function generateColorTask(): CognitiveTask {
  const roll = Math.random();
  const motion = randomMotion();

  if (roll < 0.4) {
    // 単純カラー
    const color = randomItem(COLORS);
    return {
      type: 'color',
      display: color,
      speech: color,
      correctMotion: motion,
    };
  } else if (roll < 0.7) {
    // 〇〇以外
    const color = randomItem(COLORS);
    return {
      type: 'condition',
      display: `${color}以外`,
      speech: `${color}以外`,
      correctMotion: motion,
    };
  } else {
    // 〇〇または〇〇
    const c1 = randomItem(COLORS);
    let c2 = randomItem(COLORS);
    while (c2 === c1) c2 = randomItem(COLORS);
    return {
      type: 'condition',
      display: `${c1}または${c2}`,
      speech: `${c1}または${c2}`,
      correctMotion: motion,
    };
  }
}

function generateNumberTask(): CognitiveTask {
  const motion = randomMotion();
  const roll = Math.random();

  if (roll < 0.3) {
    const n = randomItem(NUMBERS);
    return {
      type: 'number',
      display: String(n),
      speech: String(n),
      correctMotion: motion,
    };
  } else if (roll < 0.5) {
    return { type: 'condition', display: '偶数', speech: '偶数', correctMotion: motion };
  } else if (roll < 0.7) {
    return { type: 'condition', display: '奇数', speech: '奇数', correctMotion: motion };
  } else if (roll < 0.85) {
    return { type: 'condition', display: '最大', speech: '最大', correctMotion: motion };
  } else {
    return { type: 'condition', display: '最小', speech: '最小', correctMotion: motion };
  }
}

function generateReverseTask(): CognitiveTask {
  const motion = randomMotion();
  const pairs: Array<{ display: string; speech: string }> = [
    { display: '右 → 左へ移動', speech: '右と表示されたら左へ' },
    { display: '前 → 後ろへ移動', speech: '前と表示されたら後ろへ' },
    { display: '左 → 右へ移動', speech: '左と表示されたら右へ' },
    { display: '後 → 前へ移動', speech: '後ろと表示されたら前へ' },
  ];
  const pair = randomItem(pairs);
  return {
    type: 'reverse',
    display: pair.display,
    speech: pair.speech,
    correctMotion: motion,
  };
}

// ===== メイン生成関数 =====

export function generateQuestion(): TrainingQuestion {
  const cognitiveTypes: CognitiveType[] = ['color', 'number', 'reverse', 'condition'];
  const type = randomItem(cognitiveTypes);

  let cognitive: CognitiveTask;
  switch (type) {
    case 'color':
      cognitive = generateColorTask();
      break;
    case 'number':
      cognitive = generateNumberTask();
      break;
    case 'reverse':
      cognitive = generateReverseTask();
      break;
    case 'condition':
      cognitive = Math.random() < 0.5 ? generateColorTask() : generateNumberTask();
      break;
    default:
      cognitive = generateColorTask();
  }

  const motionLabel = MOTION_LABELS[cognitive.correctMotion];
  const speechText = `${cognitive.speech}。${motionLabel}`;

  return {
    cognitive,
    motionLabel,
    speechText,
  };
}

export { MOTION_LABELS };
