import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import type { TrainingLevel } from '@/lib/types';
import { LEVEL_CONFIG, COLOR_HEX } from '@/lib/types';

export default function RulesScreen() {
  const router = useRouter();
  const { level, difficulty } = useLocalSearchParams<{ level: TrainingLevel; difficulty: string }>();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [showStartButton, setShowStartButton] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lv = (level as TrainingLevel) || 'level1';
  const diff = difficulty || 'beginner';

  // ===== ルール説明の内容を生成 =====
  const getRuleContent = () => {
    if (lv === 'level1') {
      return {
        title: 'レベル1：方向認識',
        rules: [
          { label: '前', value: '前へ移動' },
          { label: '後', value: '後ろへ移動' },
          { label: '左', value: '左へ移動' },
          { label: '右', value: '右へ移動' },
        ],
        type: 'direction',
      };
    } else if (lv === 'level2') {
      return {
        title: 'レベル2：数字認識',
        rules: [
          { label: '1', value: '前へ移動' },
          { label: '2', value: '後ろへ移動' },
          { label: '3', value: '左へ移動' },
          { label: '4', value: '右へ移動' },
        ],
        type: 'number',
      };
    } else if (lv === 'level3') {
      return {
        title: 'レベル3：色認識',
        rules: [
          { label: '赤', value: '前へ移動', color: COLOR_HEX.red },
          { label: '青', value: '後ろへ移動', color: COLOR_HEX.blue },
          { label: '黄', value: '左へ移動', color: COLOR_HEX.yellow },
          { label: '緑', value: '右へ移動', color: COLOR_HEX.green },
        ],
        type: 'color',
      };
    } else {
      // レベル4：複合認識 - 全ての対応表を表示
      return {
        title: 'レベル4：複合認識',
        subtitle: '方向・数字・色がランダムに出題されます',
        rules: [
          { label: '前', value: '前へ移動' },
          { label: '後', value: '後ろへ移動' },
          { label: '左', value: '左へ移動' },
          { label: '右', value: '右へ移動' },
          { label: '1', value: '前へ移動' },
          { label: '2', value: '後ろへ移動' },
          { label: '3', value: '左へ移動' },
          { label: '4', value: '右へ移動' },
          { label: '赤', value: '前へ移動', color: COLOR_HEX.red },
          { label: '青', value: '後ろへ移動', color: COLOR_HEX.blue },
          { label: '黄', value: '左へ移動', color: COLOR_HEX.yellow },
          { label: '緑', value: '右へ移動', color: COLOR_HEX.green },
        ],
        type: 'mixed',
      };
    }
  };

  const ruleContent = getRuleContent();

  // ===== ボタン表示タイマー（1秒後に表示） =====
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setShowStartButton(true);
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleStartTraining = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    router.replace({
      pathname: '/training' as any,
      params: { level: lv, difficulty: diff },
    });
  };

  return (
    <ScreenContainer className="bg-background" edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mainContainer}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.primary, fontSize: isTablet ? 36 : 28 }]}>
            {ruleContent.title}
          </Text>

          {/* サブタイトル（レベル4のみ） */}
          {'subtitle' in ruleContent && ruleContent.subtitle && (
            <Text style={[styles.subtitle, { color: colors.muted, fontSize: isTablet ? 16 : 14 }]}>
              {ruleContent.subtitle}
            </Text>
          )}
        </View>

        {/* スクロール可能な対応表エリア */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.rulesContainer}
          showsVerticalScrollIndicator={true}
        >
          {ruleContent.rules.map((rule, idx) => (
            <View key={idx} style={styles.ruleRow}>
              {ruleContent.type === 'color' && 'color' in rule && rule.color ? (
                <View
                  style={[
                    styles.ruleLabel,
                    {
                      backgroundColor: rule.color,
                      width: isTablet ? 100 : 80,
                      height: isTablet ? 100 : 80,
                    },
                  ]}
                >
                  <Text style={[styles.ruleLabelText, { fontSize: isTablet ? 24 : 18 }]}>
                    {rule.label}
                  </Text>
                </View>
              ) : ruleContent.type === 'mixed' && 'color' in rule && rule.color ? (
                <View
                  style={[
                    styles.ruleLabel,
                    {
                      backgroundColor: rule.color,
                      width: isTablet ? 70 : 60,
                      height: isTablet ? 70 : 60,
                    },
                  ]}
                >
                  <Text style={[styles.ruleLabelText, { fontSize: isTablet ? 18 : 14 }]}>
                    {rule.label}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.ruleLabel,
                    {
                      backgroundColor: colors.surface,
                      width: ruleContent.type === 'mixed' ? (isTablet ? 70 : 60) : (isTablet ? 100 : 80),
                      height: ruleContent.type === 'mixed' ? (isTablet ? 70 : 60) : (isTablet ? 100 : 80),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.ruleLabelText,
                      {
                        color: colors.foreground,
                        fontSize: ruleContent.type === 'mixed' ? (isTablet ? 16 : 13) : (isTablet ? 24 : 18),
                      },
                    ]}
                  >
                    {rule.label}
                  </Text>
                </View>
              )}

              <View style={styles.arrow}>
                <Text style={[styles.arrowText, { fontSize: isTablet ? 20 : 16 }]}>→</Text>
              </View>

              <View style={styles.ruleValue}>
                <Text
                  style={[
                    styles.ruleValueText,
                    { color: colors.foreground, fontSize: ruleContent.type === 'mixed' ? (isTablet ? 14 : 12) : (isTablet ? 20 : 16) },
                  ]}
                >
                  {rule.value}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* フッター：ボタンエリア（常に表示） */}
        <View style={styles.footer}>
          {showStartButton ? (
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: colors.primary }]}
              onPress={handleStartTraining}
              activeOpacity={0.85}
            >
              <Text style={[styles.startBtnText, { fontSize: isTablet ? 18 : 16 }]}>
                ▶ トレーニングを開始する
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.waitText, { color: colors.muted, fontSize: isTablet ? 14 : 12 }]}>
              対応表を確認してください...
            </Text>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
  },
  rulesContainer: {
    gap: 12,
    paddingVertical: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ruleLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  ruleLabelText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  arrow: {
    marginHorizontal: 4,
  },
  arrowText: {
    fontWeight: '600',
    color: '#999',
  },
  ruleValue: {
    flex: 1,
    paddingHorizontal: 12,
  },
  ruleValueText: {
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200, 200, 200, 0.2)',
  },
  startBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  waitText: {
    fontWeight: '500',
    textAlign: 'center',
  },
});
