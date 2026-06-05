import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import type { Difficulty } from '@/lib/types';
import { DIFFICULTY_CONFIG } from '@/lib/types';
import { ScreenContainer } from '@/components/screen-container';

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'elite'];

const DIFFICULTY_EMOJI: Record<Difficulty, string> = {
  beginner: '🟢',
  intermediate: '🟡',
  advanced: '🟠',
  elite: '🔴',
};

const DIFFICULTY_DESC: Record<Difficulty, string> = {
  beginner: '3秒以内に反応',
  intermediate: '2秒以内に反応',
  advanced: '1秒以内に反応',
  elite: '0.7秒以内に反応',
};

export default function DifficultyScreen() {
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const handleSelect = (difficulty: Difficulty) => {
    router.push({ pathname: '/calibration' as any, params: { difficulty } });
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.container, { paddingHorizontal: isTablet ? 48 : 24 }]}>
        <Text style={[styles.title, { fontSize: isTablet ? 30 : 24, color: colors.foreground }]}>
          難易度を選択
        </Text>
        <Text style={[styles.subtitle, { color: colors.muted, fontSize: isTablet ? 16 : 14 }]}>
          制限時間内に正しい動作を行ってください
        </Text>

        <View style={styles.cards}>
          {DIFFICULTIES.map(d => (
            <TouchableOpacity
              key={d}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  paddingVertical: isTablet ? 24 : 18,
                },
              ]}
              onPress={() => handleSelect(d)}
              activeOpacity={0.8}
            >
              <Text style={[styles.cardEmoji, { fontSize: isTablet ? 36 : 28 }]}>
                {DIFFICULTY_EMOJI[d]}
              </Text>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.foreground, fontSize: isTablet ? 22 : 18 }]}>
                  {DIFFICULTY_CONFIG[d].label}
                </Text>
                <Text style={[styles.cardDesc, { color: colors.muted, fontSize: isTablet ? 15 : 13 }]}>
                  {DIFFICULTY_DESC[d]}
                </Text>
              </View>
              <Text style={[styles.arrow, { color: colors.primary }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.muted, fontSize: isTablet ? 16 : 14 }]}>
            ← 戻る
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 32,
  },
  cards: {
    flex: 1,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  cardEmoji: {
    lineHeight: 44,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: '700',
  },
  cardDesc: {
    marginTop: 2,
  },
  arrow: {
    fontSize: 28,
    fontWeight: '300',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingVertical: 8,
  },
  backText: {
    fontWeight: '500',
  },
});
