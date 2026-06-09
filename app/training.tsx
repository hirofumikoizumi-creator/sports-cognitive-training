import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Animated, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import jpeg from 'jpeg-js';
import { useColors } from '@/hooks/use-colors';
import { useScreenOrientation } from '@/hooks/use-screen-orientation';
import { useAppContext } from '@/lib/AppContext';
import type { ColorName, Difficulty, Direction, JudgeResult, TrainingLevel, TrainingQuestion } from '@/lib/types';
import { DIFFICULTY_CONFIG, LEVEL_CONFIG } from '@/lib/types';
import { generateQuestionsForLevel, generateSessionMappings } from '@/lib/questionGeneratorV2';
import { buildResult } from '@/lib/scoring';

const TOTAL_QUESTIONS = 20;
const CAPTURE_INTERVAL_MS = 260;
const BASELINE_DELAY_MS = 700;
const COUNTDOWN_SECONDS = 5;
const AWAY_CHANGE_RATIO = 0.0025;
const TARGET_ZONE_RATIO = 0.0028;
const HOME_CHANGE_RATIO = 0.020;
const RETURN_FRAMES_REQUIRED = 2;

type ExpectedMotion = 'step_forward' | 'step_back' | 'step_left' | 'step_right';
type MotionPhase = 'settling' | 'waitingAway' | 'waitingReturn';
type CalibrationKey = 'center' | Direction;
type MotionZone = 'center' | Direction;

interface LumaFrame {
  width: number;
  height: number;
  luma: Uint8Array;
}

interface FrameAnalysis {
  changeRatio: number;
  centerX: number;
  centerY: number;
  radialMean: number;
  leftRatio: number;
  rightRatio: number;
  centerRatio: number;
  forwardRatio: number;
  backRatio: number;
}

interface CalibrationStatus {
  key: CalibrationKey;
  title: string;
  detail: string;
}

interface GridMotion {
  bestZone: MotionZone;
  confidence: number;
  totalChangeRatio: number;
  zones: Record<MotionZone, number>;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];

  for (let i = 0; i < clean.length;) {
    const enc1 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc2 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc3 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc4 = BASE64_CHARS.indexOf(clean.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes.push(chr1);
    if (enc3 !== 64) bytes.push(chr2);
    if (enc4 !== 64) bytes.push(chr3);
  }

  return new Uint8Array(bytes);
}

function toLumaFrame(base64: string): LumaFrame | null {
  try {
    const decoded = jpeg.decode(decodeBase64(base64), { useTArray: true });
    const luma = new Uint8Array(decoded.width * decoded.height);

    for (let i = 0, j = 0; i < decoded.data.length; i += 4, j += 1) {
      luma[j] = (decoded.data[i] * 0.299 + decoded.data[i + 1] * 0.587 + decoded.data[i + 2] * 0.114) | 0;
    }

    return { width: decoded.width, height: decoded.height, luma };
  } catch {
    return null;
  }
}

function analyzeAgainstBaseline(
  baseline: LumaFrame,
  current: LumaFrame,
): FrameAnalysis | null {
  if (baseline.width !== current.width || baseline.height !== current.height) return null;

  let changed = 0;
  let sumX = 0;
  let sumY = 0;
  let sumRadial = 0;
  let leftChanged = 0;
  let rightChanged = 0;
  let centerChanged = 0;
  let forwardChanged = 0;
  let backChanged = 0;
  let leftSampled = 0;
  let rightSampled = 0;
  let centerSampled = 0;
  let forwardSampled = 0;
  let backSampled = 0;
  const threshold = 14;
  const step = 5;
  const width = current.width;
  const height = current.height;
  const startY = Math.floor(height * 0.12);
  const endY = Math.floor(height * 0.92);

  for (let y = startY; y < endY; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = y * width + x;
      const nx = x / width;
      const ny = y / height;
      if (nx < 0.35) leftSampled += 1;
      if (nx > 0.65) rightSampled += 1;
      if (nx >= 0.35 && nx <= 0.65 && ny >= 0.25 && ny <= 0.75) centerSampled += 1;
      if (nx >= 0.34 && nx <= 0.66 && ny >= 0.08 && ny <= 0.46) backSampled += 1;
      if (nx >= 0.30 && nx <= 0.70 && ny >= 0.54 && ny <= 0.94) forwardSampled += 1;

      if (Math.abs(current.luma[index] - baseline.luma[index]) < threshold) continue;

      changed += 1;
      sumX += nx;
      sumY += ny;
      sumRadial += Math.hypot(nx - 0.5, ny - 0.5);
      if (nx < 0.35) leftChanged += 1;
      if (nx > 0.65) rightChanged += 1;
      if (nx >= 0.35 && nx <= 0.65 && ny >= 0.25 && ny <= 0.75) centerChanged += 1;
      if (nx >= 0.34 && nx <= 0.66 && ny >= 0.08 && ny <= 0.46) backChanged += 1;
      if (nx >= 0.30 && nx <= 0.70 && ny >= 0.54 && ny <= 0.94) forwardChanged += 1;
    }
  }

  const sampled = Math.ceil((endY - startY) / step) * Math.ceil(width / step);
  if (changed < Math.max(10, sampled * 0.002)) {
    return {
      changeRatio: 0,
      centerX: 0.5,
      centerY: 0.5,
      radialMean: 0,
      leftRatio: 0,
      rightRatio: 0,
      centerRatio: 0,
      forwardRatio: 0,
      backRatio: 0,
    };
  }

  return {
    changeRatio: changed / sampled,
    centerX: sumX / changed,
    centerY: sumY / changed,
    radialMean: sumRadial / changed,
    leftRatio: leftSampled ? leftChanged / leftSampled : 0,
    rightRatio: rightSampled ? rightChanged / rightSampled : 0,
    centerRatio: centerSampled ? centerChanged / centerSampled : 0,
    forwardRatio: forwardSampled ? forwardChanged / forwardSampled : 0,
    backRatio: backSampled ? backChanged / backSampled : 0,
  };
}

function isAwayMotion(expected: ExpectedMotion, analysis: FrameAnalysis): boolean {
  if (analysis.changeRatio < AWAY_CHANGE_RATIO) return false;

  switch (expected) {
    case 'step_right':
      return analysis.rightRatio > TARGET_ZONE_RATIO || analysis.centerX > 0.58;
    case 'step_left':
      return analysis.leftRatio > TARGET_ZONE_RATIO || analysis.centerX < 0.42;
    case 'step_forward':
      return analysis.forwardRatio > TARGET_ZONE_RATIO || analysis.changeRatio > 0.018 || analysis.centerY > 0.54;
    case 'step_back':
      return analysis.backRatio > TARGET_ZONE_RATIO || (analysis.changeRatio > 0.01 && analysis.centerY < 0.48);
    default:
      return false;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function directionFromMotion(motion: ExpectedMotion): Direction {
  const motionToDirection: Record<ExpectedMotion, Direction> = {
    step_forward: 'forward',
    step_back: 'back',
    step_left: 'left',
    step_right: 'right',
  };
  return motionToDirection[motion];
}

function directionScore(direction: Direction, analysis: FrameAnalysis): number {
  switch (direction) {
    case 'right':
      return analysis.rightRatio * 2.8 + Math.max(0, analysis.centerX - 0.52) * 0.9 + analysis.changeRatio;
    case 'left':
      return analysis.leftRatio * 2.8 + Math.max(0, 0.48 - analysis.centerX) * 0.9 + analysis.changeRatio;
    case 'forward':
      return analysis.forwardRatio * 2.4 + Math.max(0, analysis.centerY - 0.50) * 0.7 + analysis.changeRatio * 1.4;
    case 'back':
      return analysis.backRatio * 2.4 + Math.max(0, 0.50 - analysis.centerY) * 0.7 + analysis.changeRatio * 1.2;
    default:
      return 0;
  }
}

function calibratedDirectionScore(
  direction: Direction,
  analysis: FrameAnalysis,
  templates: Partial<Record<Direction, FrameAnalysis>>,
): number {
  const rawScore = directionScore(direction, analysis);
  const template = templates[direction];
  if (!template) return rawScore;

  const sameShape =
    Math.max(0, 0.04 - Math.abs(directionScore(direction, template) - rawScore)) * 8 +
    Math.max(0, 0.20 - Math.abs(template.centerX - analysis.centerX)) * 0.5 +
    Math.max(0, 0.20 - Math.abs(template.centerY - analysis.centerY)) * 0.5;

  return rawScore + sameShape;
}

function detectCalibratedMotion(
  expected: ExpectedMotion,
  analysis: FrameAnalysis,
  templates: Partial<Record<Direction, FrameAnalysis>>,
): boolean {
  if (analysis.changeRatio < AWAY_CHANGE_RATIO) return false;

  const expectedDirection = directionFromMotion(expected);
  const expectedScore = calibratedDirectionScore(expectedDirection, analysis, templates);
  const otherScores = (['forward', 'back', 'left', 'right'] as Direction[])
    .filter(direction => direction !== expectedDirection)
    .map(direction => calibratedDirectionScore(direction, analysis, templates));
  const bestOther = Math.max(0, ...otherScores);
  const templateScore = directionScore(expectedDirection, templates[expectedDirection] ?? analysis);
  const adaptiveThreshold = Math.max(TARGET_ZONE_RATIO * 1.8, Math.min(0.09, templateScore * 0.34));

  return expectedScore >= adaptiveThreshold && expectedScore >= bestOther * 0.82;
}

function getGridZone(nx: number, ny: number): MotionZone | null {
  if (nx <= 0.30 && ny >= 0.16 && ny <= 0.84) return 'left';
  if (nx >= 0.70 && ny >= 0.16 && ny <= 0.84) return 'right';
  if (nx >= 0.30 && nx <= 0.70 && ny <= 0.34) return 'back';
  if (nx >= 0.30 && nx <= 0.70 && ny >= 0.66) return 'forward';
  if (nx >= 0.34 && nx <= 0.66 && ny >= 0.34 && ny <= 0.66) return 'center';
  return null;
}

function analyzeGridMotion(baseline: LumaFrame, current: LumaFrame): GridMotion | null {
  if (baseline.width !== current.width || baseline.height !== current.height) return null;

  const changedByZone: Record<MotionZone, number> = {
    center: 0,
    forward: 0,
    back: 0,
    left: 0,
    right: 0,
  };
  const sampledByZone: Record<MotionZone, number> = {
    center: 0,
    forward: 0,
    back: 0,
    left: 0,
    right: 0,
  };

  const threshold = 8;
  const step = 4;
  let totalChanged = 0;
  let totalSampled = 0;

  for (let y = 0; y < current.height; y += step) {
    for (let x = 0; x < current.width; x += step) {
      const nx = x / current.width;
      const ny = y / current.height;
      const zone = getGridZone(nx, ny);
      if (!zone) continue;

      sampledByZone[zone] += 1;
      totalSampled += 1;

      const index = y * current.width + x;
      if (Math.abs(current.luma[index] - baseline.luma[index]) < threshold) continue;

      changedByZone[zone] += 1;
      totalChanged += 1;
    }
  }

  const zones: Record<MotionZone, number> = {
    center: sampledByZone.center ? changedByZone.center / sampledByZone.center : 0,
    forward: sampledByZone.forward ? changedByZone.forward / sampledByZone.forward : 0,
    back: sampledByZone.back ? changedByZone.back / sampledByZone.back : 0,
    left: sampledByZone.left ? changedByZone.left / sampledByZone.left : 0,
    right: sampledByZone.right ? changedByZone.right / sampledByZone.right : 0,
  };
  const movementZones = ['forward', 'back', 'left', 'right'] as Direction[];
  const bestZone = movementZones.reduce<MotionZone>((best, zone) => (
    zones[zone] > zones[best] ? zone : best
  ), 'forward');

  return {
    bestZone,
    confidence: zones[bestZone],
    totalChangeRatio: totalSampled ? totalChanged / totalSampled : 0,
    zones,
  };
}

function isExpectedGridMotion(expected: Direction, grid: GridMotion): boolean {
  const expectedScore = grid.zones[expected];
  const oppositeDirection: Record<Direction, Direction> = {
    right: 'left',
    left: 'right',
    forward: 'back',
    back: 'forward',
  };
  const oppositeScore = grid.zones[oppositeDirection[expected]];
  const bestOther = Math.max(
    ...(['forward', 'back', 'left', 'right'] as Direction[])
      .filter(direction => direction !== expected)
      .map(direction => grid.zones[direction]),
  );

  return (
    expectedScore >= TARGET_ZONE_RATIO &&
    grid.totalChangeRatio >= AWAY_CHANGE_RATIO &&
    expectedScore >= oppositeScore * 0.75 &&
    expectedScore >= bestOther * 0.55
  );
}

export default function TrainingScreen() {
  useKeepAwake();
  useScreenOrientation('LANDSCAPE');
  const router = useRouter();
  const { difficulty, level } = useLocalSearchParams<{ difficulty: Difficulty; level: TrainingLevel }>();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { state, addResult } = useAppContext();
  const [permission, requestPermission] = useCameraPermissions();

  const diff = (difficulty as Difficulty) || 'beginner';
  const lv = (level as TrainingLevel) || 'level1';
  const timeLimit = DIFFICULTY_CONFIG[diff].timeLimit;

  // セッション中は出題と対応表を固定する
  const sessionMappingsRef = useRef<ReturnType<typeof generateSessionMappings> | null>(null);
  const questionsRef = useRef<TrainingQuestion[] | null>(null);
  if (!sessionMappingsRef.current) {
    sessionMappingsRef.current = generateSessionMappings();
  }
  if (!questionsRef.current) {
    questionsRef.current = generateQuestionsForLevel(
      lv,
      sessionMappingsRef.current.numberMapping,
      sessionMappingsRef.current.colorMapping,
    );
  }
  const questions = questionsRef.current;

  // ===== State =====
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<TrainingQuestion>(questions[0]);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [results, setResults] = useState<Array<{ result: JudgeResult; reactionTimeMs: number }>>([]);
  const [timerProgress, setTimerProgress] = useState(1);
  const [isFinished, setIsFinished] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [calibrationDone, setCalibrationDone] = useState(Platform.OS === 'web');
  const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus>({
    key: 'center',
    title: '中央',
    detail: '中央に立ってください',
  });
  const [trainingStarted, setTrainingStarted] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [motionHint, setMotionHint] = useState('中央で待機');
  const [debugMotionText, setDebugMotionText] = useState('');

  const cameraRef = useRef<CameraView | null>(null);
  const questionStartTime = useRef(Date.now());
  const sessionStartTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baselineFrame = useRef<LumaFrame | null>(null);
  const baselineReadyAt = useRef(0);
  const directionTemplates = useRef<Partial<Record<Direction, FrameAnalysis>>>({});
  const motionPhase = useRef<MotionPhase>('settling');
  const returnFrames = useRef(0);
  const judgedRef = useRef(false);
  const captureBusy = useRef(false);
  const calibrationRunning = useRef(false);
  const unmountedRef = useRef(false);
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web' && !permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      Speech.stop();
    };
  }, []);

  const canStartCalibration = Platform.OS !== 'web' && permission?.granted && cameraReady;
  const canStartCountdown = Platform.OS === 'web' || calibrationDone;

  // ===== 問題表示テキストを生成 =====
  const getQuestionDisplay = (q: TrainingQuestion): string => {
    if (q.type === 'level1') {
      return q.displayText;
    } else if (q.type === 'level2') {
      return String(q.number);
    } else if (q.type === 'level3') {
      return '●'; // カラーカード
    }
    return '';
  };

  // ===== 問題から期待される動作方向を取得 =====
  const getExpectedDirection = (q: TrainingQuestion): Direction => {
    let direction: Direction = 'forward';
    
    if (q.type === 'level1') {
      direction = q.direction;
    } else if (q.type === 'level2') {
      direction = q.correctDirection;
    } else if (q.type === 'level3') {
      direction = q.correctDirection;
    }

    return direction;
  };

  // ===== 問題から期待される動作方向を取得 =====
  const getExpectedMotion = (q: TrainingQuestion): ExpectedMotion => {
    const directionToMotion: Record<Direction, ExpectedMotion> = {
      forward: 'step_forward',
      back: 'step_back',
      left: 'step_left',
      right: 'step_right',
    };
    
    return directionToMotion[getExpectedDirection(q)];
  };

  const getDirectionMoveLabel = (direction: Direction): string => {
    const labels: Record<Direction, string> = {
      forward: '前へ移動',
      back: '後ろへ移動',
      left: '左へ移動',
      right: '右へ移動',
    };
    return labels[direction];
  };

  const getSpeechCue = (q: TrainingQuestion): string => {
    if (q.type === 'level1') {
      const cues: Record<Direction, string> = {
        forward: 'まえ！',
        back: 'うしろ！',
        left: 'ひだり！',
        right: 'みぎ！',
      };
      return cues[q.direction];
    }

    if (q.type === 'level2') {
      const cues: Record<1 | 2 | 3 | 4, string> = {
        1: 'いち！',
        2: 'に！',
        3: 'さん！',
        4: 'よん！',
      };
      return cues[q.number];
    }

    const colorCues: Record<ColorName, string> = {
      blue: 'あお！',
      red: 'あか！',
      yellow: 'き！',
      green: 'みどり！',
    };
    return colorCues[q.color];
  };

  const captureLumaSnapshot = useCallback(async (): Promise<LumaFrame | null> => {
    if (Platform.OS === 'web' || !cameraRef.current) return null;

    const photo = await cameraRef.current.takePictureAsync({
      base64: true,
      quality: 0.2,
      skipProcessing: true,
      shutterSound: false,
    });

    if (!photo.base64) return null;
    return toLumaFrame(photo.base64);
  }, []);

  // ===== 問題開始 =====
  const startQuestion = useCallback((q: TrainingQuestion) => {
    setCurrentQuestion(q);
    setJudgeResult(null);
    setMotionHint('中央で待機');
    setDebugMotionText('');
    judgedRef.current = false;
    baselineReadyAt.current = Date.now() + 250;
    motionPhase.current = 'settling';
    returnFrames.current = 0;
    questionStartTime.current = Date.now();
    setTimerProgress(1);

    if (state.settings.voiceEnabled && Platform.OS !== 'web') {
      Speech.stop();
      Speech.speak(getSpeechCue(q), { language: 'ja-JP', rate: 1.18, pitch: 1.08 });
    }
  }, [state.settings.voiceEnabled]);

  // ===== タイマー =====
  useEffect(() => {
    if (isFinished || !trainingStarted) return;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - questionStartTime.current;
      const progress = Math.max(0, 1 - elapsed / timeLimit);
      setTimerProgress(progress);

      if (elapsed >= timeLimit && !judgedRef.current) {
        handleJudge('timeout', timeLimit);
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [questionIndex, isFinished, timeLimit, trainingStarted]);

  const captureAndJudge = useCallback(async () => {
    if (
      Platform.OS === 'web' ||
      isFinished ||
      !trainingStarted ||
      judgedRef.current ||
      captureBusy.current ||
      !cameraReady ||
      !cameraRef.current
    ) {
      return;
    }

    captureBusy.current = true;
    try {
      const frame = await captureLumaSnapshot();
      if (!frame) return;

      if (!baselineFrame.current || Date.now() < baselineReadyAt.current) {
        baselineFrame.current = frame;
        setMotionHint('中央で待機');
        return;
      }

      const analysis = analyzeAgainstBaseline(baselineFrame.current, frame);
      if (!analysis) return;
      const grid = analyzeGridMotion(baselineFrame.current, frame);
      if (!grid) return;

      const expectedMotion = getExpectedMotion(currentQuestion);
      const expectedDirection = getExpectedDirection(currentQuestion);
      const directionScores = (['right', 'left', 'forward', 'back'] as Direction[])
        .map(direction => `${getDirectionMoveLabel(direction).replace('へ移動', '')}:${Math.round(grid.zones[direction] * 1000)}`)
        .join(' / ');
      setDebugMotionText(`グリッド:${grid.bestZone} ${Math.round(grid.confidence * 1000)} / ${directionScores}`);

      if (motionPhase.current === 'settling') {
        motionPhase.current = 'waitingAway';
        setMotionHint(getDirectionMoveLabel(expectedDirection));
      }

      if (motionPhase.current === 'waitingAway') {
        if (
          isExpectedGridMotion(expectedDirection, grid) ||
          detectCalibratedMotion(expectedMotion, analysis, directionTemplates.current) ||
          isAwayMotion(expectedMotion, analysis)
        ) {
          motionPhase.current = 'waitingReturn';
          returnFrames.current = 0;
          setMotionHint('中央に戻る');
        }
        return;
      }

      if (motionPhase.current === 'waitingReturn') {
        if (
          grid.totalChangeRatio <= HOME_CHANGE_RATIO ||
          grid.zones[expectedDirection] <= TARGET_ZONE_RATIO * 0.45
        ) {
          returnFrames.current += 1;
        } else {
          returnFrames.current = 0;
        }

        if (returnFrames.current >= RETURN_FRAMES_REQUIRED) {
          const elapsed = Date.now() - questionStartTime.current;
          handleJudge('success', elapsed);
        }
      }
    } finally {
      captureBusy.current = false;
    }
  }, [cameraReady, captureLumaSnapshot, currentQuestion, isFinished, trainingStarted]);

  // ===== カメラフレーム判定ループ =====
  useEffect(() => {
    if (isFinished || !trainingStarted || Platform.OS === 'web' || !permission?.granted) return;
    captureRef.current = setInterval(captureAndJudge, CAPTURE_INTERVAL_MS);

    return () => {
      if (captureRef.current) clearInterval(captureRef.current);
    };
  }, [captureAndJudge, isFinished, permission?.granted, trainingStarted]);

  // ===== 判定処理 =====
  const handleJudge = useCallback((result: JudgeResult, reactionTimeMs: number) => {
    if (judgedRef.current) return;
    judgedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);

    setJudgeResult(result);

    // ハプティクス
    if (Platform.OS !== 'web') {
      if (result === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    // スコア更新
    setResults(prev => {
      const newResults = [...prev, { result, reactionTimeMs }];
      return newResults;
    });

    if (result === 'success') {
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        const comboBonus = Math.min(newCombo * 10, 50);
        const speedBonus = Math.max(0, 50 - Math.floor(reactionTimeMs / 100));
        setScore(s => s + 100 + comboBonus + speedBonus);
        return newCombo;
      });
    } else {
      setCombo(0);
    }

    // フィードバックアニメーション
    feedbackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(feedbackAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    // 次の問題へ
    const nextIndex = questionIndex + 1;
    setTimeout(() => {
      if (nextIndex >= TOTAL_QUESTIONS) {
        finishSession([...results, { result, reactionTimeMs }]);
      } else {
        setQuestionIndex(nextIndex);
        startQuestion(questions[nextIndex]);
      }
    }, 800);
  }, [questionIndex, results, startQuestion, questions]);

  // ===== セッション終了 =====
  const finishSession = useCallback((finalResults: Array<{ result: JudgeResult; reactionTimeMs: number }>) => {
    setIsFinished(true);
    Speech.stop();

    const trainingResult = buildResult({
      level: lv,
      difficulty: diff,
      results: finalResults,
      startTime: sessionStartTime.current,
      endTime: Date.now(),
    });

    addResult(trainingResult);

    router.replace({
      pathname: '/result' as any,
      params: { resultId: trainingResult.id },
    });
  }, [lv, diff, addResult, router]);

  // ===== セッション専用キャリブレーション =====
  useEffect(() => {
    if (!canStartCalibration || calibrationDone || calibrationRunning.current) return;

    const directionSteps: Array<{ key: Direction; title: string; cue: string }> = [
      { key: 'right', title: '右', cue: 'みぎ！' },
      { key: 'left', title: '左', cue: 'ひだり！' },
      { key: 'forward', title: '前', cue: 'まえ！' },
      { key: 'back', title: '後', cue: 'うしろ！' },
    ];

    calibrationRunning.current = true;

    const speak = (text: string) => {
      if (state.settings.voiceEnabled && Platform.OS !== 'web') {
        Speech.stop();
        Speech.speak(text, { language: 'ja-JP', rate: 1.08, pitch: 1.05 });
      }
    };

    const runCalibration = async () => {
      try {
        setCalibrationStatus({ key: 'center', title: '中央', detail: '中央の枠に立ってください' });
        speak('ちゅうおう');
        await wait(1200);
        if (unmountedRef.current) return;

        const centerFrame = await captureLumaSnapshot();
        if (centerFrame) {
          baselineFrame.current = centerFrame;
        }

        for (const step of directionSteps) {
          if (unmountedRef.current) return;
          setCalibrationStatus({ key: step.key, title: step.title, detail: `${step.title}の領域へ移動してください` });
          speak(step.cue);
          await wait(1300);
          if (unmountedRef.current) return;

          const directionFrame = await captureLumaSnapshot();
          if (directionFrame && baselineFrame.current) {
            const analysis = analyzeAgainstBaseline(baselineFrame.current, directionFrame);
            if (analysis && analysis.changeRatio > 0) {
              directionTemplates.current[step.key] = analysis;
            }
          }

          setCalibrationStatus({ key: 'center', title: '中央', detail: '中央へ戻ってください' });
          speak('ちゅうおう');
          await wait(1000);
          if (unmountedRef.current) return;

          const returnedCenterFrame = await captureLumaSnapshot();
          if (returnedCenterFrame) {
            baselineFrame.current = returnedCenterFrame;
          }
        }

        setCalibrationDone(true);
      } finally {
        calibrationRunning.current = false;
      }
    };

    runCalibration();
  }, [calibrationDone, canStartCalibration, captureLumaSnapshot, state.settings.voiceEnabled]);

  // 初回問題開始
  useEffect(() => {
    if (!canStartCountdown || trainingStarted || countdownRef.current) return;

    setCountdown(COUNTDOWN_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          sessionStartTime.current = Date.now();
          setTrainingStarted(true);
          startQuestion(questions[0]);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [canStartCountdown, questions, startQuestion, trainingStarted]);

  // ===== UI =====
  const feedbackColor =
    judgeResult === 'success' ? colors.success :
    judgeResult === 'fail' ? colors.error :
    judgeResult === 'timeout' ? colors.warning : 'transparent';

  const feedbackLabel =
    judgeResult === 'success' ? '✓ 成功！' :
    judgeResult === 'fail' ? '✗ 失敗' :
    judgeResult === 'timeout' ? '⏱ タイムオーバー' : '';

  const timerColor =
    timerProgress > 0.5 ? colors.success :
    timerProgress > 0.25 ? colors.warning : colors.error;

  // レベル3（色）の場合、背景色を変更
  const bgColor = currentQuestion.type === 'level3' 
    ? currentQuestion.colorHex 
    : '#000000';

  if (Platform.OS !== 'web' && !permission?.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionText, { color: colors.foreground }]}>
          トレーニングにはフロントカメラの使用許可が必要です
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>カメラを許可する</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* カメラ背景 */}
      {Platform.OS !== 'web' ? (
        <CameraView 
          ref={cameraRef}
          style={StyleSheet.absoluteFill} 
          facing="front"
          onCameraReady={() => {
            setCameraReady(true);
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} />
      )}

      {/* 半透明オーバーレイ */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      {/* 動く位置の常時ガイド */}
      <View pointerEvents="none" style={styles.zoneGuide}>
        <View style={[styles.sideZone, styles.leftZone]}>
          <Text style={styles.zoneLabel}>左</Text>
        </View>
        <View style={[styles.sideZone, styles.rightZone]}>
          <Text style={styles.zoneLabel}>右</Text>
        </View>
        <View style={styles.centerZone}>
          <Text style={styles.zoneLabel}>中央</Text>
        </View>
        <View style={[styles.depthZone, styles.backZone]}>
          <Text style={styles.zoneLabel}>後</Text>
        </View>
        <View style={[styles.depthZone, styles.forwardZone]}>
          <Text style={styles.zoneLabel}>前</Text>
        </View>
      </View>

      {/* タイマーバー */}
      <View style={styles.timerContainer}>
        <View style={[styles.timerBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <View
            style={[
              styles.timerFill,
              { width: `${timerProgress * 100}%` as any, backgroundColor: timerColor },
            ]}
          />
        </View>
        <View style={styles.topInfo}>
          <Text style={[styles.progressText, { fontSize: isTablet ? 16 : 13 }]}>
            {questionIndex + 1} / {TOTAL_QUESTIONS}
          </Text>
          <Text style={[styles.scoreText, { fontSize: isTablet ? 20 : 16 }]}>
            {score.toLocaleString()} pt
          </Text>
          {combo > 1 && (
            <Text style={[styles.comboText, { color: colors.warning, fontSize: isTablet ? 16 : 13 }]}>
              🔥 {combo} コンボ
            </Text>
          )}
        </View>
      </View>

      {/* 問題表示 */}
      <View style={styles.questionArea}>
        {!calibrationDone ? (
          <View style={styles.calibrationBox}>
            <Text style={[styles.calibrationTitle, { fontSize: isTablet ? 72 : 56 }]}>
              {calibrationStatus.title}
            </Text>
            <Text style={[styles.calibrationText, { fontSize: isTablet ? 22 : 18 }]}>
              {calibrationStatus.detail}
            </Text>
          </View>
        ) : !trainingStarted ? (
          <View style={styles.countdownBox}>
            <Text style={[styles.countdownNumber, { fontSize: isTablet ? 96 : 76 }]}>
              {countdown}
            </Text>
            <Text style={[styles.countdownText, { fontSize: isTablet ? 22 : 18 }]}>
              中央で構えてください
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.cognitiveText, { fontSize: isTablet ? 80 : 64, color: '#FFFFFF' }]}>
              {getQuestionDisplay(currentQuestion)}
            </Text>
            {currentQuestion.type === 'level3' && (
              <View style={[styles.colorCard, { backgroundColor: currentQuestion.colorHex }]} />
            )}
            <View style={styles.motionHintBox}>
              <Text style={[styles.motionHintText, { fontSize: isTablet ? 20 : 16 }]}>
                {motionHint}
              </Text>
              {!!debugMotionText && (
                <Text style={styles.debugMotionText}>
                  {debugMotionText}
                </Text>
              )}
            </View>
          </>
        )}
      </View>

      {/* 判定フィードバック */}
      {judgeResult && (
        <Animated.View
          style={[
            styles.feedbackOverlay,
            {
              backgroundColor: `${feedbackColor}CC`,
              opacity: feedbackAnim,
            },
          ]}
        >
          <Text style={[styles.feedbackText, { fontSize: isTablet ? 48 : 36 }]}>
            {feedbackLabel}
          </Text>
        </Animated.View>
      )}

      {/* レベル・難易度表示 */}
      <View style={styles.infoBadge}>
        <Text style={[styles.infoText, { fontSize: isTablet ? 13 : 11 }]}>
          {LEVEL_CONFIG[lv].label} / {DIFFICULTY_CONFIG[diff].label}
        </Text>
      </View>

      {/* 中断ボタン */}
      <TouchableOpacity
        style={styles.stopBtn}
        onPress={() => {
          Speech.stop();
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (captureRef.current) clearInterval(captureRef.current);
          router.back();
        }}
      >
        <Text style={styles.stopText}>■ 中断</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  permissionText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  zoneGuide: {
    ...StyleSheet.absoluteFillObject,
  },
  sideZone: {
    position: 'absolute',
    top: '16%',
    bottom: '16%',
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  leftZone: {
    left: 0,
    borderRightWidth: 1,
  },
  rightZone: {
    right: 0,
    borderLeftWidth: 1,
  },
  centerZone: {
    position: 'absolute',
    left: '34%',
    right: '34%',
    top: '34%',
    bottom: '34%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  depthZone: {
    position: 'absolute',
    left: '30%',
    right: '30%',
    height: '34%',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  backZone: {
    top: 0,
    borderBottomWidth: 1,
  },
  forwardZone: {
    bottom: 0,
    borderTopWidth: 1,
  },
  zoneLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  timerBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 4,
  },
  topInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  progressText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  scoreText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  comboText: {
    fontWeight: '700',
  },
  questionArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
  },
  cognitiveText: {
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    lineHeight: 96,
  },
  colorCard: {
    width: 120,
    height: 120,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  calibrationBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minWidth: 240,
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  calibrationTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    lineHeight: 86,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  calibrationText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  countdownBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontWeight: '900',
    lineHeight: 104,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  countdownText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
  motionHintBox: {
    minWidth: 160,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  motionHintText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  debugMotionText: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  infoBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  infoText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  stopBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(255,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stopText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
