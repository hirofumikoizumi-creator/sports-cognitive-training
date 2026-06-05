/**
 * 4レベル構成の問題生成エンジン
 *
 * レベル1: 方向認識（前後左右）
 * レベル2: 数字認識（1-4の対応表）
 * レベル3: 色認識（赤青黄緑の対応表）
 * レベル4: 複合認識（方向・数字・色がランダムに出題）
 */

import type {
  TrainingLevel,
  TrainingQuestion,
  Direction,
  ColorName,
  Level1Question,
  Level2Question,
  Level3Question,
  Level4Question,
} from './types';
import { DIRECTION_LABELS, COLOR_LABELS, COLOR_HEX } from './types';

// ===== ヘルパー関数 =====

/**
 * 配列をシャッフルする（Fisher-Yates）
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * ランダムな方向を選択
 */
function randomDirection(): Direction {
  const dirs: Direction[] = ['forward', 'back', 'left', 'right'];
  return dirs[Math.floor(Math.random() * dirs.length)];
}

/**
 * ランダムな色を選択
 */
function randomColor(): ColorName {
  const colors: ColorName[] = ['red', 'blue', 'yellow', 'green'];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * 数字→方向のランダムマッピングを生成
 */
function generateNumberMapping(): Record<1 | 2 | 3 | 4, Direction> {
  const dirs = shuffle<Direction>(['forward', 'back', 'left', 'right']);
  return {
    1: dirs[0],
    2: dirs[1],
    3: dirs[2],
    4: dirs[3],
  };
}

/**
 * 色→方向のランダムマッピングを生成
 */
function generateColorMapping(): Record<ColorName, Direction> {
  const dirs = shuffle<Direction>(['forward', 'back', 'left', 'right']);
  return {
    red: dirs[0],
    blue: dirs[1],
    yellow: dirs[2],
    green: dirs[3],
  };
}

// ===== レベル別問題生成 =====

/**
 * レベル1: 方向認識
 * 表示: 「前」「後」「左」「右」のテキスト
 */
export function generateLevel1Question(): Level1Question {
  const direction = randomDirection();
  return {
    type: 'level1',
    direction,
    displayText: DIRECTION_LABELS[direction],
  };
}

/**
 * レベル2: 数字認識
 * 表示: 数字（1-4）
 * 対応表はセッション共通で外部から渡される
 */
export function generateLevel2Question(mapping: Record<1 | 2 | 3 | 4, Direction>): Level2Question {
  const number = (Math.floor(Math.random() * 4) + 1) as 1 | 2 | 3 | 4;
  const correctDirection = mapping[number];
  return {
    type: 'level2',
    number,
    mapping,
    correctDirection,
  };
}

/**
 * レベル3: 色認識
 * 表示: カラーカード
 * 対応表はセッション共通で外部から渡される
 */
export function generateLevel3Question(mapping: Record<ColorName, Direction>): Level3Question {
  const color = randomColor();
  const correctDirection = mapping[color];
  return {
    type: 'level3',
    color,
    mapping,
    correctDirection,
    colorHex: COLOR_HEX[color],
  };
}

/**
 * レベル4: 複合認識
 * 方向・数字・色がランダムに出題される
 */
export function generateLevel4Question(
  numberMapping: Record<1 | 2 | 3 | 4, Direction>,
  colorMapping: Record<ColorName, Direction>,
): Level4Question {
  const questionType = Math.floor(Math.random() * 3);

  if (questionType === 0) {
    // 方向問題
    return generateLevel1Question();
  } else if (questionType === 1) {
    // 数字問題
    return generateLevel2Question(numberMapping);
  } else {
    // 色問題
    return generateLevel3Question(colorMapping);
  }
}

// ===== セッション用の問題リスト生成 =====

/**
 * レベル別に20問の問題リストを生成
 */
export function generateQuestionsForLevel(
  level: TrainingLevel,
  numberMapping?: Record<1 | 2 | 3 | 4, Direction>,
  colorMapping?: Record<ColorName, Direction>,
): TrainingQuestion[] {
  const questions: TrainingQuestion[] = [];

  // マッピングが未定義の場合は生成
  const numMap = numberMapping || generateNumberMapping();
  const colMap = colorMapping || generateColorMapping();

  for (let i = 0; i < 20; i++) {
    if (level === 'level1') {
      questions.push(generateLevel1Question());
    } else if (level === 'level2') {
      questions.push(generateLevel2Question(numMap));
    } else if (level === 'level3') {
      questions.push(generateLevel3Question(colMap));
    } else if (level === 'level4') {
      questions.push(generateLevel4Question(numMap, colMap));
    }
  }

  return questions;
}

/**
 * セッション用のマッピングを生成
 * （レベル2以上で使用）
 */
export function generateSessionMappings() {
  return {
    numberMapping: generateNumberMapping(),
    colorMapping: generateColorMapping(),
  };
}
