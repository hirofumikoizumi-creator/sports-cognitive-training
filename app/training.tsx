import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Animated, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/use-colors';
import { useScreenOrientation } from '@/hooks/use-screen-orientation';
import { useAppContext } from '@/lib/AppContext';
import type { Difficulty, JudgeResult, PoseLandmarks, TrainingLevel, TrainingQuestion } from '@/lib/types';
import { DIFFICULTY_CONFIG, LEVEL_CONFIG } from '@/lib/types';
import { generateQuestionsForLevel, generateSessionMappings } from '@/lib/questionGeneratorV2';
import { judgeMotion, isPoseDetected } from '@/lib/poseJudge';
import { buildResult } from '@/lib/scoring';

const TOTAL_QUESTIONS = 20;

export default function TrainingScreen() {
  useKeepAwake();
  useScreenOrientation('LANDSCAPE');
  const router = useRouter();
  const { difficulty, level } = useLocalSearchParams<{ difficulty: Difficulty; level: TrainingLevel }>();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { state, addResult } = useAppContext();

  const diff = (difficulty as Difficulty) || 'beginner';
  const lv = (level as TrainingLevel) || 'level1';
  const timeLimit = DIFFICULTY_CONFIG[diff].timeLimit;

  // セッション用のマッピングを生成
  const { numberMapping, colorMapping } = generateSessionMappings();
  const questions = generateQuestionsForLevel(lv, numberMapping, colorMapping);

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

  const questionStartTime = useRef(Date.now());
  const sessionStartTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const judgeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPose = useRef<PoseLandmarks | null>(null);
  const currentPose = useRef<PoseLandmarks | null>(null);
  const judgedRef = useRef(false);
  const feedbackAnim = useRef(new Animated.Value(0)).current;

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
  const getExpectedMotion = (q: TrainingQuestion): 'step_forward' | 'step_back' | 'step_left' | 'step_right' => {
    let direction: 'forward' | 'back' | 'left' | 'right' = 'forward';
    
    if (q.type === 'level1') {
      direction = (q as any).direction;
    } else if (q.type === 'level2') {
      direction = (q as any).correctDirection;
    } else if (q.type === 'level3') {
      direction = (q as any).correctDirection;
    } else {
      // level4は複合型なので、元の型を判定して対応する方向を取得
      if ('direction' in q) {
        direction = (q as any).direction;
      } else if ('correctDirection' in q) {
        direction = (q as any).correctDirection;
      }
    }
    
    // Direction型をMotionType型に変換
    const directionToMotion: Record<'forward' | 'back' | 'left' | 'right', 'step_forward' | 'step_back' | 'step_left' | 'step_right'> = {
      forward: 'step_forward',
      back: 'step_back',
      left: 'step_left',
      right: 'step_right',
    };
    
    return directionToMotion[direction];
  };

  // ===== 問題開始 =====
  const startQuestion = useCallback((q: TrainingQuestion) => {
    setCurrentQuestion(q);
    setJudgeResult(null);
    judgedRef.current = false;
    questionStartTime.current = Date.now();
    setTimerProgress(1);

    // 音声読み上げ（レベル別）
    if (state.settings.voiceEnabled && Platform.OS !== 'web') {
      Speech.stop();
      let speechText = '';
      if (q.type === 'level1') {
        speechText = `${q.displayText}へ移動`;
      } else if (q.type === 'level2') {
        speechText = `${(q as any).number}番の方向へ移動`;
      } else if (q.type === 'level3') {
        speechText = `${(q as any).color}の方向へ移動`;
      } else if ((q as any).type === 'level4') {
        if ('direction' in q) {
          speechText = `${(q as any).displayText}へ移動`;
        } else if ('number' in q) {
          speechText = `${(q as any).number}番の方向へ移動`;
        } else if ('color' in q) {
          speechText = `${(q as any).color}の方向へ移動`;
        }
      }
      Speech.speak(speechText, { language: 'ja-JP', rate: 1.1 });
    }
  }, [state.settings.voiceEnabled]);

  // ===== タイマー =====
  useEffect(() => {
    if (isFinished) return;
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
  }, [questionIndex, isFinished, timeLimit]);

  // ===== ポーズ判定ループ =====
  useEffect(() => {
    if (isFinished) return;
    judgeRef.current = setInterval(() => {
      if (judgedRef.current) return;
      const prev = prevPose.current;
      const curr = currentPose.current;
      if (!prev || !curr) return;

      // 期待される動作方向を取得
      const expectedMotion = getExpectedMotion(currentQuestion);

      // 実際のポーズから動作を判定
      const isCorrect = judgeMotion(expectedMotion, prev, curr);

      if (isCorrect) {
        const elapsed = Date.now() - questionStartTime.current;
        handleJudge('success', elapsed);
      }
    }, 100);

    return () => {
      if (judgeRef.current) clearInterval(judgeRef.current);
    };
  }, [currentQuestion]);

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

  // 初回問題開始
  useEffect(() => {
    sessionStartTime.current = Date.now();
    startQuestion(currentQuestion);
    return () => {
      Speech.stop();
    };
  }, []);

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

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* カメラ背景 */}
      {Platform.OS !== 'web' ? (
        <CameraView 
          style={StyleSheet.absoluteFill} 
          facing="back"
          onCameraReady={() => {
            // カメラ準備完了時の処理
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} />
      )}

      {/* 半透明オーバーレイ */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

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
        <Text style={[styles.cognitiveText, { fontSize: isTablet ? 80 : 64, color: '#FFFFFF' }]}>
          {getQuestionDisplay(currentQuestion)}
        </Text>
        {currentQuestion.type === 'level3' && (
          <View style={[styles.colorCard, { backgroundColor: currentQuestion.colorHex }]} />
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
          router.back();
        }}
      >
        <Text style={styles.stopText}>■ 中断</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
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
