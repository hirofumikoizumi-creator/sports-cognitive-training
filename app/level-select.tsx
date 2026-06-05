import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import type { TrainingLevel, Difficulty } from '@/lib/types';
import { LEVEL_CONFIG, DIFFICULTY_CONFIG } from '@/lib/types';

export default function LevelSelectScreen() {
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [selectedLevel, setSelectedLevel] = useState<TrainingLevel>('level1');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('beginner');

  const levels: TrainingLevel[] = ['level1', 'level2', 'level3', 'level4'];
  const difficulties: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'elite'];

  const handleStart = () => {
    router.push({
      pathname: '/rules' as any,
      params: { level: selectedLevel, difficulty: selectedDifficulty },
    });
  };

  const levelBtnSize = isTablet ? 100 : 80;
  const diffBtnSize = isTablet ? 90 : 70;

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* タイトル */}
        <Text style={[styles.title, { color: colors.primary, fontSize: isTablet ? 32 : 24 }]}>
          トレーニング選択
        </Text>

        {/* レベル選択 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontSize: isTablet ? 18 : 16 }]}>
            レベルを選択
          </Text>
          <View style={styles.buttonGrid}>
            {levels.map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.levelBtn,
                  {
                    width: levelBtnSize,
                    height: levelBtnSize,
                    backgroundColor: selectedLevel === level ? colors.primary : colors.surface,
                    borderColor: selectedLevel === level ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedLevel(level)}
              >
                <Text
                  style={[
                    styles.levelBtnText,
                    {
                      color: selectedLevel === level ? '#FFFFFF' : colors.foreground,
                      fontSize: isTablet ? 14 : 12,
                    },
                  ]}
                >
                  {LEVEL_CONFIG[level].label}
                </Text>
                <Text
                  style={[
                    styles.levelBtnDesc,
                    {
                      color: selectedLevel === level ? '#FFFFFF' : colors.muted,
                      fontSize: isTablet ? 11 : 9,
                    },
                  ]}
                >
                  {LEVEL_CONFIG[level].description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 難易度選択 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontSize: isTablet ? 18 : 16 }]}>
            難易度を選択
          </Text>
          <View style={styles.buttonGrid}>
            {difficulties.map((difficulty) => (
              <TouchableOpacity
                key={difficulty}
                style={[
                  styles.diffBtn,
                  {
                    width: diffBtnSize,
                    height: diffBtnSize,
                    backgroundColor: selectedDifficulty === difficulty ? colors.primary : colors.surface,
                    borderColor: selectedDifficulty === difficulty ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedDifficulty(difficulty)}
              >
                <Text
                  style={[
                    styles.diffBtnText,
                    {
                      color: selectedDifficulty === difficulty ? '#FFFFFF' : colors.foreground,
                      fontSize: isTablet ? 13 : 11,
                    },
                  ]}
                >
                  {DIFFICULTY_CONFIG[difficulty].label}
                </Text>
                <Text
                  style={[
                    styles.diffBtnTime,
                    {
                      color: selectedDifficulty === difficulty ? '#FFFFFF' : colors.muted,
                      fontSize: isTablet ? 10 : 8,
                    },
                  ]}
                >
                  {DIFFICULTY_CONFIG[difficulty].timeLimit}ms
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* スタートボタン */}
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: colors.primary }]}
          onPress={handleStart}
        >
          <Text style={[styles.startBtnText, { fontSize: isTablet ? 18 : 16 }]}>
            ▶ スタート
          </Text>
        </TouchableOpacity>

        {/* 戻るボタン */}
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backBtnText, { color: colors.foreground, fontSize: isTablet ? 14 : 12 }]}>
            ← 戻る
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 32,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
  },
  section: {
    width: '100%',
    gap: 16,
  },
  sectionTitle: {
    fontWeight: '700',
    marginLeft: 8,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  levelBtn: {
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  levelBtnText: {
    fontWeight: '700',
  },
  levelBtnDesc: {
    fontWeight: '500',
  },
  diffBtn: {
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  diffBtnText: {
    fontWeight: '700',
  },
  diffBtnTime: {
    fontWeight: '500',
  },
  startBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  backBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontWeight: '600',
  },
});
