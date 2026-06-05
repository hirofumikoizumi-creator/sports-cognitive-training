import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrainingResult, AppSettings } from './types';

const KEYS = {
  RESULTS: 'sct_results',
  SETTINGS: 'sct_settings',
  ONBOARDING: 'sct_onboarding_done',
} as const;

// ===== 設定 =====

const DEFAULT_SETTINGS: AppSettings = {
  voiceEnabled: true,
  darkMode: false,
  onboardingDone: false,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

// ===== 結果履歴 =====

export async function loadResults(): Promise<TrainingResult[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.RESULTS);
    if (!raw) return [];
    return JSON.parse(raw) as TrainingResult[];
  } catch {
    return [];
  }
}

export async function saveResult(result: TrainingResult): Promise<void> {
  const existing = await loadResults();
  const updated = [result, ...existing].slice(0, 200); // 最大200件
  await AsyncStorage.setItem(KEYS.RESULTS, JSON.stringify(updated));
}

export async function clearResults(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.RESULTS);
}

// ===== 統計 =====

export interface Stats {
  bestScore: number;
  totalPlays: number;
  totalDurationMs: number;
}

export function calcStats(results: TrainingResult[]): Stats {
  if (results.length === 0) {
    return { bestScore: 0, totalPlays: 0, totalDurationMs: 0 };
  }
  return {
    bestScore: Math.max(...results.map(r => r.totalScore)),
    totalPlays: results.length,
    totalDurationMs: results.reduce((acc, r) => acc + r.durationMs, 0),
  };
}
