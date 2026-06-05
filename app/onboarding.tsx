import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { useColors } from '@/hooks/use-colors';
import { useAppContext } from '@/lib/AppContext';

const PAGES = [
  {
    emoji: '📱',
    title: 'スマホを設置する',
    body: 'iPhoneまたはiPadを床・机・三脚などに設置し、全身が映るようにカメラを向けてください。',
  },
  {
    emoji: '🏃',
    title: '動いてトレーニング',
    body: '画面と音声の指示に従って身体を動かします。認知・判断・反応・身体操作を同時に鍛えます。',
  },
  {
    emoji: '🏆',
    title: 'スコアで成長を確認',
    body: '成功率・反応時間・コンボ数でランクが決まります。毎日続けて競技力を向上させましょう！',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateSettings } = useAppContext();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [page, setPage] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();

  const isLast = page === PAGES.length - 1;

  const handleNext = async () => {
    if (!isLast) {
      setPage(p => p + 1);
      return;
    }
    // 最終ページ: カメラ権限を取得
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    updateSettings({ onboardingDone: true });
    router.replace('/' as any);
  };

  const current = PAGES[page];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.emoji, { fontSize: isTablet ? 96 : 72 }]}>{current.emoji}</Text>
        <Text style={[styles.title, { fontSize: isTablet ? 32 : 26, color: colors.foreground }]}>
          {current.title}
        </Text>
        <Text style={[styles.body, { fontSize: isTablet ? 18 : 16, color: colors.muted }]}>
          {current.body}
        </Text>
      </View>

      {/* ページインジケーター */}
      <View style={styles.dots}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === page ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>

      {/* ボタン */}
      <TouchableOpacity
        style={[
          styles.btn,
          { backgroundColor: colors.primary, height: isTablet ? 64 : 56 },
        ]}
        onPress={handleNext}
        activeOpacity={0.85}
      >
        <Text style={[styles.btnText, { fontSize: isTablet ? 20 : 17 }]}>
          {isLast ? 'カメラを許可して始める' : '次へ'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 48,
    paddingTop: 80,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  emoji: {
    lineHeight: 120,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 40,
  },
  body: {
    textAlign: 'center',
    lineHeight: 26,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  btn: {
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
