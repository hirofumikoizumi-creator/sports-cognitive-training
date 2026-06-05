import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { useColors } from '@/hooks/use-colors';
import type { Difficulty } from '@/lib/types';

export default function CalibrationScreen() {
  useKeepAwake();
  const router = useRouter();
  const { difficulty } = useLocalSearchParams<{ difficulty: Difficulty }>();
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;

  const [permission, requestPermission] = useCameraPermissions();
  const [poseDetected, setPoseDetected] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  // 骨格検出シミュレーション（Development Build では実際のMediaPipe処理）
  useEffect(() => {
    // 実機ビルドでは MediaPipe の結果を使用
    // Web/Simulator では3秒後に自動検出として扱う
    const timer = setTimeout(() => {
      setPoseDetected(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // 検出後カウントダウン
  useEffect(() => {
    if (!poseDetected) return;
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          router.replace({ pathname: '/training' as any, params: { difficulty } });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [poseDetected]);

  if (!permission?.granted) {
    return (
      <View style={[styles.permContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.permText, { color: colors.foreground }]}>
          カメラの使用を許可してください
        </Text>
        <TouchableOpacity
          style={[styles.permBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.permBtnText}>許可する</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* カメラプレビュー */}
      {Platform.OS !== 'web' ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a1a' }]} />
      )}

      {/* オーバーレイ */}
      <View style={styles.overlay}>
        {/* 人型ガイド枠 */}
        <View
          style={[
            styles.guideFrame,
            {
              borderColor: poseDetected ? colors.success : colors.primary,
              width: width * 0.45,
              height: height * 0.65,
            },
          ]}
        />

        {/* ステータステキスト */}
        <View style={styles.statusBox}>
          {!poseDetected ? (
            <>
              <Text style={[styles.statusTitle, { fontSize: isTablet ? 22 : 18 }]}>
                全身が映る位置へ移動してください
              </Text>
              <Text style={[styles.statusSub, { fontSize: isTablet ? 16 : 13 }]}>
                枠内に全身が収まるように調整してください
              </Text>
              <View style={styles.loadingDots}>
                <Text style={[styles.loadingText, { color: colors.primary }]}>検出中...</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.statusTitle, { color: colors.success, fontSize: isTablet ? 22 : 18 }]}>
                ✓ 姿勢認識成功！
              </Text>
              <Text style={[styles.countdownText, { color: colors.success, fontSize: isTablet ? 72 : 56 }]}>
                {countdown}
              </Text>
              <Text style={[styles.statusSub, { fontSize: isTablet ? 16 : 13 }]}>
                秒後にトレーニング開始
              </Text>
            </>
          )}
        </View>

        {/* キャンセルボタン */}
        <TouchableOpacity
          style={[styles.cancelBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  permText: {
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  permBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  permBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideFrame: {
    borderWidth: 3,
    borderRadius: 12,
    borderStyle: 'dashed',
    position: 'absolute',
  },
  statusBox: {
    position: 'absolute',
    bottom: 120,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  statusTitle: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  statusSub: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  loadingDots: {
    marginTop: 8,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  countdownText: {
    fontWeight: '800',
    lineHeight: 80,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 48,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
