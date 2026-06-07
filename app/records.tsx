import { View, Text, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAppContext } from '@/lib/AppContext';
import { useColors } from '@/hooks/use-colors';
import { calcStats } from '@/lib/storage';
import type { TrainingResult } from '@/lib/types';
import { DIFFICULTY_CONFIG } from '@/lib/types';
import { AdBanner } from '@/components/AdBanner';

const RANK_COLORS: Record<string, string> = {
  S: '#FFD700',
  A: '#00A86B',
  B: '#2196F3',
  C: '#FF9800',
  D: '#9E9E9E',
};

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}分${sec}秒`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ResultCard({ item, colors, isTablet }: { item: TrainingResult; colors: any; isTablet: boolean }) {
  const rankColor = RANK_COLORS[item.rank] ?? colors.primary;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardLeft}>
        <Text style={[styles.rankBadge, { color: rankColor, fontSize: isTablet ? 32 : 26 }]}>
          {item.rank}
        </Text>
      </View>
      <View style={styles.cardCenter}>
        <Text style={[styles.cardScore, { color: colors.foreground, fontSize: isTablet ? 20 : 17 }]}>
          {item.totalScore.toLocaleString()} pt
        </Text>
        <Text style={[styles.cardSub, { color: colors.muted, fontSize: isTablet ? 13 : 11 }]}>
          成功率 {Math.round(item.successRate * 100)}% ・ 反応 {(item.avgReactionTime / 1000).toFixed(2)}秒
        </Text>
        <Text style={[styles.cardSub, { color: colors.muted, fontSize: isTablet ? 13 : 11 }]}>
          コンボ {item.maxCombo} ・ {DIFFICULTY_CONFIG[item.difficulty].label}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={[styles.cardDate, { color: colors.muted, fontSize: isTablet ? 12 : 10 }]}>
          {formatDate(item.date)}
        </Text>
      </View>
    </View>
  );
}

export default function RecordsScreen() {
  const { state } = useAppContext();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const stats = calcStats(state.results);
  const totalHours = Math.floor(stats.totalDurationMs / 3600000);
  const totalMin = Math.floor((stats.totalDurationMs % 3600000) / 60000);

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.container, { paddingHorizontal: isTablet ? 32 : 16 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontSize: isTablet ? 28 : 22 }]}>
          記録
        </Text>

        {/* サマリー */}
        <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SummaryItem
            label="ベストスコア"
            value={stats.bestScore.toLocaleString()}
            colors={colors}
            isTablet={isTablet}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SummaryItem
            label="プレイ回数"
            value={String(stats.totalPlays)}
            colors={colors}
            isTablet={isTablet}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SummaryItem
            label="累計時間"
            value={totalHours > 0 ? `${totalHours}h${totalMin}m` : `${totalMin}分`}
            colors={colors}
            isTablet={isTablet}
          />
        </View>

        {/* 履歴リスト */}
        {state.results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.muted, fontSize: isTablet ? 18 : 15 }]}>
              まだ記録がありません
            </Text>
            <Text style={[styles.emptyHint, { color: colors.muted, fontSize: isTablet ? 15 : 13 }]}>
              トレーニングを完了すると記録が保存されます
            </Text>
          </View>
        ) : (
          <FlatList
            data={state.results}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ResultCard item={item} colors={colors} isTablet={isTablet} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        <AdBanner style={styles.adBanner} />
      </View>
    </ScreenContainer>
  );
}

function SummaryItem({ label, value, colors, isTablet }: { label: string; value: string; colors: any; isTablet: boolean }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color: colors.primary, fontSize: isTablet ? 24 : 20 }]}>
        {value}
      </Text>
      <Text style={[styles.summaryLabel, { color: colors.muted, fontSize: isTablet ? 12 : 10 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    fontWeight: '800',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontWeight: '700',
  },
  summaryLabel: {
    marginTop: 2,
  },
  divider: {
    width: 1,
    marginVertical: 4,
  },
  list: {
    gap: 10,
    paddingBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cardLeft: {
    width: 44,
    alignItems: 'center',
  },
  rankBadge: {
    fontWeight: '900',
    lineHeight: 36,
  },
  cardCenter: {
    flex: 1,
    gap: 2,
  },
  cardScore: {
    fontWeight: '700',
  },
  cardSub: {
    lineHeight: 18,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  cardDate: {
    lineHeight: 16,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontWeight: '600',
  },
  emptyHint: {
    textAlign: 'center',
  },
  adBanner: {
    marginTop: 8,
  },
});
