import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions, Share, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useColors } from '@/hooks/use-colors';
import { useAppContext } from '@/lib/AppContext';
import { ScreenContainer } from '@/components/screen-container';
import type { TrainingResult } from '@/lib/types';
import { DIFFICULTY_CONFIG } from '@/lib/types';

const RANK_COLORS: Record<string, string> = {
  S: '#FFD700',
  A: '#00A86B',
  B: '#2196F3',
  C: '#FF9800',
  D: '#9E9E9E',
};

export default function ResultScreen() {
  const router = useRouter();
  const { resultId } = useLocalSearchParams<{ resultId: string }>();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { state } = useAppContext();

  const [result, setResult] = useState<TrainingResult | null>(null);

  useEffect(() => {
    if (resultId) {
      const found = state.results.find(r => r.id === resultId);
      setResult(found ?? null);
    }
  }, [resultId, state.results]);

  const handleShare = async () => {
    if (!result) return;
    const text = `スポーツ認知反応トレーニング\n\nスコア：${result.totalScore.toLocaleString()}\n成功率：${Math.round(result.successRate * 100)}%\n平均反応時間：${(result.avgReactionTime / 1000).toFixed(2)}秒\n最大コンボ：${result.maxCombo}\nランク：${result.rank}\n\n#スポ認トレ`;

    try {
      if (Platform.OS === 'web') {
        await Share.share({ message: text });
      } else {
        const fileUri = FileSystem.cacheDirectory + 'result.txt';
        await FileSystem.writeAsStringAsync(fileUri, text);
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(fileUri, { dialogTitle: '結果をシェア' });
        } else {
          await Share.share({ message: text });
        }
      }
    } catch (e) {
      // シェアキャンセルは無視
    }
  };

  if (!result) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: colors.muted }]}>読み込み中...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const rankColor = RANK_COLORS[result.rank] ?? colors.primary;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView contentContainerStyle={[styles.container, { paddingHorizontal: isTablet ? 48 : 24 }]}>
        {/* ランク */}
        <View style={styles.rankSection}>
          <Text style={[styles.rankLabel, { color: colors.muted, fontSize: isTablet ? 16 : 13 }]}>
            ランク
          </Text>
          <Text style={[styles.rankText, { color: rankColor, fontSize: isTablet ? 120 : 96 }]}>
            {result.rank}
          </Text>
          <Text style={[styles.diffLabel, { color: colors.muted, fontSize: isTablet ? 15 : 13 }]}>
            {DIFFICULTY_CONFIG[result.difficulty].label}
          </Text>
        </View>

        {/* スコアカード */}
        <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScoreRow
            label="総得点"
            value={result.totalScore.toLocaleString() + ' pt'}
            colors={colors}
            isTablet={isTablet}
            highlight
          />
          <ScoreRow
            label="成功率"
            value={Math.round(result.successRate * 100) + '%'}
            colors={colors}
            isTablet={isTablet}
          />
          <ScoreRow
            label="平均反応時間"
            value={(result.avgReactionTime / 1000).toFixed(2) + ' 秒'}
            colors={colors}
            isTablet={isTablet}
          />
          <ScoreRow
            label="最大コンボ"
            value={result.maxCombo + ' 回'}
            colors={colors}
            isTablet={isTablet}
          />
          <ScoreRow
            label="成功 / 失敗 / タイムオーバー"
            value={`${result.successCount} / ${result.failCount} / ${result.timeoutCount}`}
            colors={colors}
            isTablet={isTablet}
          />
        </View>

        {/* ボタン */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, height: isTablet ? 64 : 56 }]}
            onPress={() => router.replace('/difficulty' as any)}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryBtnText, { fontSize: isTablet ? 20 : 17 }]}>
              もう一度
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.primary, height: isTablet ? 56 : 48 }]}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.primary, fontSize: isTablet ? 18 : 15 }]}>
              結果をシェア
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/' as any)}
          >
            <Text style={[styles.homeBtnText, { color: colors.muted, fontSize: isTablet ? 16 : 14 }]}>
              ホームへ戻る
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function ScoreRow({
  label, value, colors, isTablet, highlight,
}: {
  label: string;
  value: string;
  colors: any;
  isTablet: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.scoreRow}>
      <Text style={[styles.scoreLabel, { color: colors.muted, fontSize: isTablet ? 15 : 13 }]}>
        {label}
      </Text>
      <Text style={[
        styles.scoreValue,
        { color: highlight ? colors.primary : colors.foreground, fontSize: isTablet ? 20 : 17 },
      ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  container: {
    paddingTop: 32,
    paddingBottom: 48,
    gap: 24,
  },
  rankSection: {
    alignItems: 'center',
    gap: 4,
  },
  rankLabel: {
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rankText: {
    fontWeight: '900',
    lineHeight: 120,
  },
  diffLabel: {
    fontWeight: '500',
  },
  scoreCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  scoreLabel: {
    fontWeight: '500',
  },
  scoreValue: {
    fontWeight: '700',
  },
  buttons: {
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontWeight: '700',
  },
  homeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  homeBtnText: {
    fontWeight: '500',
  },
});
