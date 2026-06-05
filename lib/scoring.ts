import type { JudgeResult, TrainingResult, Difficulty, TrainingLevel } from './types';

export interface SessionData {
  level: TrainingLevel;
  difficulty: Difficulty;
  results: Array<{ result: JudgeResult; reactionTimeMs: number }>;
  startTime: number;
  endTime: number;
}

/** ランク算出: 成功率と平均反応時間から算出 */
export function calcRank(
  successRate: number,
  avgReactionTimeMs: number,
  timeLimitMs: number,
): 'S' | 'A' | 'B' | 'C' | 'D' {
  // 反応速度スコア: 制限時間に対する速さ (0-1)
  const speedScore = Math.max(0, 1 - avgReactionTimeMs / timeLimitMs);
  // 総合スコア: 成功率70% + 速度30%
  const composite = successRate * 0.7 + speedScore * 0.3;

  if (composite >= 0.9) return 'S';
  if (composite >= 0.75) return 'A';
  if (composite >= 0.6) return 'B';
  if (composite >= 0.4) return 'C';
  return 'D';
}

/** セッションデータからトレーニング結果を生成 */
export function buildResult(session: SessionData): TrainingResult {
  const { level, difficulty, results, startTime, endTime } = session;

  const successCount = results.filter((r) => r.result === 'success').length;
  const failCount = results.filter((r) => r.result === 'fail').length;
  const timeoutCount = results.filter((r) => r.result === 'timeout').length;
  const total = results.length;

  const successRate = total > 0 ? successCount / total : 0;

  const successTimes = results.filter((r) => r.result === 'success').map((r) => r.reactionTimeMs);
  const avgReactionTime =
    successTimes.length > 0 ? successTimes.reduce((a, b) => a + b, 0) / successTimes.length : 0;

  // コンボ計算
  let maxCombo = 0;
  let currentCombo = 0;
  for (const r of results) {
    if (r.result === 'success') {
      currentCombo++;
      maxCombo = Math.max(maxCombo, currentCombo);
    } else {
      currentCombo = 0;
    }
  }

  // 得点: 成功=100pt + コンボボーナス + 速度ボーナス
  let totalScore = 0;
  let combo = 0;
  for (const r of results) {
    if (r.result === 'success') {
      combo++;
      const comboBonus = Math.min(combo * 10, 50);
      const speedBonus = Math.max(0, 50 - Math.floor(r.reactionTimeMs / 100));
      totalScore += 100 + comboBonus + speedBonus;
    } else {
      combo = 0;
    }
  }

  const DIFFICULTY_TIME: Record<Difficulty, number> = {
    beginner: 3000,
    intermediate: 2000,
    advanced: 1000,
    elite: 700,
  };

  const rank = calcRank(successRate, avgReactionTime, DIFFICULTY_TIME[difficulty]);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    difficulty,
    date: new Date().toISOString().split('T')[0],
    totalScore,
    successCount,
    failCount,
    timeoutCount,
    successRate,
    avgReactionTime,
    maxCombo,
    rank,
    totalQuestions: total,
    durationMs: endTime - startTime,
    timestamp: Date.now(),
  };
}
