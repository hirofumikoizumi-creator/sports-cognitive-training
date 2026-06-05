import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAppContext } from '@/lib/AppContext';
import { useColors } from '@/hooks/use-colors';
import { calcStats } from '@/lib/storage';

export default function HomeScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const stats = calcStats(state.results);

  useEffect(() => {
    if (state.isLoaded && !state.settings.onboardingDone) {
      router.replace('/onboarding' as any);
    }
  }, [state.isLoaded, state.settings.onboardingDone]);

  const btnSize = isTablet ? 72 : 56;
  const titleSize = isTablet ? 36 : 28;
  const subtitleSize = isTablet ? 18 : 14;

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        {/* ロゴ・タイトル */}
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={[styles.logo, isTablet && styles.logoTablet]}
            resizeMode="contain"
          />
          <Text style={[styles.title, { fontSize: titleSize, color: colors.foreground }]}>
            スポーツ認知反応
          </Text>
          <Text style={[styles.title, { fontSize: titleSize, color: colors.primary }]}>
            トレーニング
          </Text>
          <Text style={[styles.subtitle, { fontSize: subtitleSize * 1.2, color: colors.primary, marginTop: 8 }]}>
            スポ認トレ
          </Text>

        </View>

        {/* 統計サマリー */}
        {stats.totalPlays > 0 && (
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary, fontSize: isTablet ? 28 : 22 }]}>
                {stats.bestScore.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted, fontSize: isTablet ? 13 : 11 }]}>
                ベストスコア
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary, fontSize: isTablet ? 28 : 22 }]}>
                {stats.totalPlays}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted, fontSize: isTablet ? 13 : 11 }]}>
                プレイ回数
              </Text>
            </View>
          </View>
        )}

        {/* メインボタン */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                height: btnSize,
                borderRadius: btnSize / 2,
              },
            ]}
            onPress={() => router.push('/level-select' as any)}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryBtnText, { fontSize: isTablet ? 22 : 18 }]}>
              ▶ トレーニング開始
            </Text>
          </TouchableOpacity>
        </View>

        {/* バナー広告プレースホルダー */}
        <View style={[styles.adBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.adText, { color: colors.muted }]}>広告</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 32,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 12,
  },
  logoTablet: {
    width: 140,
    height: 140,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 44,
  },
  subtitle: {
    marginTop: 4,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  adBanner: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adText: {
    fontSize: 12,
  },
});
