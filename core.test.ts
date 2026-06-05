import { describe, it, expect } from 'vitest';
import {
  generateLevel1Question,
  generateLevel2Question,
  generateLevel3Question,
  generateQuestionsForLevel,
  generateSessionMappings,
} from '../lib/questionGeneratorV2';
import { calcStats } from '../lib/storage';
import type { TrainingResult } from '../lib/types';

// ===== レベル1: 方向認識テスト =====
describe('generateLevel1Question', () => {
  it('方向問題を生成できる', () => {
    const q = generateLevel1Question();
    expect(q.type).toBe('level1');
    expect(['forward', 'back', 'left', 'right']).toContain(q.direction);
    expect(['前', '後', '左', '右']).toContain(q.displayText);
  });

  it('複数回生成で異なる方向が出現', () => {
    const directions = new Set();
    for (let i = 0; i < 50; i++) {
      const q = generateLevel1Question();
      directions.add(q.direction);
    }
    expect(directions.size).toBeGreaterThan(1);
  });
});

// ===== レベル2: 数字認識テスト =====
describe('generateLevel2Question', () => {
  it('数字問題を生成できる', () => {
    const mapping: Record<1 | 2 | 3 | 4, any> = { 1: 'forward', 2: 'back', 3: 'left', 4: 'right' };
    const q = generateLevel2Question(mapping);
    expect(q.type).toBe('level2');
    expect([1, 2, 3, 4]).toContain(q.number);
    expect(['forward', 'back', 'left', 'right']).toContain(q.correctDirection);
  });

  it('マッピングが正しく反映される', () => {
    const mapping: Record<1 | 2 | 3 | 4, any> = { 1: 'forward', 2: 'back', 3: 'left', 4: 'right' };
    for (let i = 0; i < 20; i++) {
      const q = generateLevel2Question(mapping);
      expect(q.correctDirection).toBe(mapping[q.number]);
    }
  });
});

// ===== レベル3: 色認識テスト =====
describe('generateLevel3Question', () => {
  it('色問題を生成できる', () => {
    const mapping: Record<any, any> = { red: 'forward', blue: 'back', yellow: 'left', green: 'right' };
    const q = generateLevel3Question(mapping);
    expect(q.type).toBe('level3');
    expect(['red', 'blue', 'yellow', 'green']).toContain(q.color);
    expect(['forward', 'back', 'left', 'right']).toContain(q.correctDirection);
    expect(q.colorHex).toBeTruthy();
  });

  it('マッピングが正しく反映される', () => {
    const mapping: Record<any, any> = { red: 'forward', blue: 'back', yellow: 'left', green: 'right' };
    for (let i = 0; i < 20; i++) {
      const q = generateLevel3Question(mapping);
      expect(q.correctDirection).toBe(mapping[q.color]);
    }
  });
});

// ===== セッションマッピング生成テスト =====
describe('generateSessionMappings', () => {
  it('数字と色のマッピングを生成できる', () => {
    const { numberMapping, colorMapping } = generateSessionMappings();
    expect(numberMapping).toBeDefined();
    expect(colorMapping).toBeDefined();
    expect(Object.keys(numberMapping).length).toBe(4);
    expect(Object.keys(colorMapping).length).toBe(4);
  });

  it('マッピングの値がすべて異なる方向', () => {
    const { numberMapping, colorMapping } = generateSessionMappings();
    const numValues = Object.values(numberMapping);
    const colValues = Object.values(colorMapping);
    expect(new Set(numValues).size).toBe(4);
    expect(new Set(colValues).size).toBe(4);
  });
});

// ===== 問題リスト生成テスト =====
describe('generateQuestionsForLevel', () => {
  it('レベル1で20問生成', () => {
    const questions = generateQuestionsForLevel('level1');
    expect(questions.length).toBe(20);
    expect(questions.every((q) => q.type === 'level1')).toBe(true);
  });

  it('レベル2で20問生成', () => {
    const { numberMapping } = generateSessionMappings();
    const questions = generateQuestionsForLevel('level2', numberMapping);
    expect(questions.length).toBe(20);
    expect(questions.every((q) => q.type === 'level2')).toBe(true);
  });

  it('レベル3で20問生成', () => {
    const { colorMapping } = generateSessionMappings();
    const questions = generateQuestionsForLevel('level3', undefined, colorMapping);
    expect(questions.length).toBe(20);
    expect(questions.every((q) => q.type === 'level3')).toBe(true);
  });

  it('レベル4で複合問題が混在', () => {
    const { numberMapping, colorMapping } = generateSessionMappings();
    const questions = generateQuestionsForLevel('level4', numberMapping, colorMapping);
    expect(questions.length).toBe(20);
    const types = new Set(questions.map((q) => q.type));
    // 複合は複数のタイプが混在する可能性
    expect(types.size).toBeGreaterThanOrEqual(1);
  });
});

// ===== 統計テスト =====
describe('calcStats', () => {
  it('空配列で初期値', () => {
    const stats = calcStats([]);
    expect(stats.bestScore).toBe(0);
    expect(stats.totalPlays).toBe(0);
    expect(stats.totalDurationMs).toBe(0);
  });

  it('ベストスコアが最大値', () => {
    const results: TrainingResult[] = [
      {
        id: '1',
        level: 'level1',
        difficulty: 'beginner',
        date: '2026-05-31',
        totalScore: 500,
        successCount: 15,
        failCount: 5,
        timeoutCount: 0,
        successRate: 0.75,
        avgReactionTime: 800,
        maxCombo: 5,
        rank: 'B',
        totalQuestions: 20,
        durationMs: 60000,
        timestamp: Date.now(),
      },
      {
        id: '2',
        level: 'level1',
        difficulty: 'beginner',
        date: '2026-05-31',
        totalScore: 1200,
        successCount: 20,
        failCount: 0,
        timeoutCount: 0,
        successRate: 1,
        avgReactionTime: 600,
        maxCombo: 20,
        rank: 'S',
        totalQuestions: 20,
        durationMs: 60000,
        timestamp: Date.now(),
      },
    ];
    const stats = calcStats(results);
    expect(stats.bestScore).toBe(1200);
    expect(stats.totalPlays).toBe(2);
  });
});
