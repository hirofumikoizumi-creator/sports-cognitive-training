import { View, Text, Switch, TouchableOpacity, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useAppContext } from '@/lib/AppContext';
import { useColors } from '@/hooks/use-colors';
import { useThemeContext } from '@/lib/theme-provider';
import { clearResults } from '@/lib/storage';
import { AdBanner } from '@/components/AdBanner';

export default function SettingsScreen() {
  const { state, updateSettings } = useAppContext();
  const colors = useColors();
  const { setColorScheme, colorScheme } = useThemeContext();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const isDark = colorScheme === 'dark';

  const handleToggleDark = (value: boolean) => {
    setColorScheme(value ? 'dark' : 'light');
    updateSettings({ darkMode: value });
  };

  const handleClearHistory = () => {
    Alert.alert(
      '履歴を削除',
      'すべての記録を削除します。この操作は元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await clearResults();
            Alert.alert('完了', '履歴を削除しました。');
          },
        },
      ],
    );
  };

  const fontSize = isTablet ? 18 : 16;
  const labelSize = isTablet ? 14 : 12;

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={[styles.container, { paddingHorizontal: isTablet ? 32 : 16 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontSize: isTablet ? 28 : 22 }]}>
          設定
        </Text>

        {/* サウンド設定 */}
        <SectionHeader label="サウンド" colors={colors} labelSize={labelSize} />
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rowLeft}>
            <Text style={[styles.rowLabel, { color: colors.foreground, fontSize }]}>音声読み上げ</Text>
            <Text style={[styles.rowDesc, { color: colors.muted, fontSize: labelSize }]}>
              問題を音声で読み上げます
            </Text>
          </View>
          <Switch
            value={state.settings.voiceEnabled}
            onValueChange={v => updateSettings({ voiceEnabled: v })}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* 表示設定 */}
        <SectionHeader label="表示" colors={colors} labelSize={labelSize} />
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rowLeft}>
            <Text style={[styles.rowLabel, { color: colors.foreground, fontSize }]}>ダークモード</Text>
            <Text style={[styles.rowDesc, { color: colors.muted, fontSize: labelSize }]}>
              暗い背景に切り替えます
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={handleToggleDark}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* データ管理 */}
        <SectionHeader label="データ管理" colors={colors} labelSize={labelSize} />
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleClearHistory}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Text style={[styles.rowLabel, { color: colors.error, fontSize }]}>履歴を全削除</Text>
            <Text style={[styles.rowDesc, { color: colors.muted, fontSize: labelSize }]}>
              すべてのトレーニング記録を削除します
            </Text>
          </View>
        </TouchableOpacity>

        {/* アプリ情報 */}
        <SectionHeader label="アプリ情報" colors={colors} labelSize={labelSize} />
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.foreground, fontSize }]}>バージョン</Text>
          <Text style={[styles.rowValue, { color: colors.muted, fontSize }]}>1.0.0</Text>
        </View>
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.foreground, fontSize }]}>アプリ名</Text>
          <Text style={[styles.rowValue, { color: colors.muted, fontSize }]}>スポーツ認知反応トレーニング</Text>
        </View>

        <AdBanner style={styles.adBanner} />
      </View>
    </ScreenContainer>
  );
}

function SectionHeader({ label, colors, labelSize }: { label: string; colors: any; labelSize: number }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.muted, fontSize: labelSize }]}>
      {label.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontWeight: '800',
    marginBottom: 16,
  },
  sectionHeader: {
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontWeight: '600',
  },
  rowDesc: {
    lineHeight: 18,
  },
  rowValue: {
    fontWeight: '500',
  },
  adBanner: {
    marginTop: 'auto',
  },
});
