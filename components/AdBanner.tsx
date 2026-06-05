/**
 * AdBanner コンポーネント
 *
 * 開発中はGoogle公式テスト広告IDを使用。
 * 本番リリース時は環境変数 ADMOB_BANNER_ID_IOS / ADMOB_BANNER_ID_ANDROID に
 * 実際の広告ユニットIDを設定してください。
 *
 * テスト広告ID:
 *   iOS:     ca-app-pub-3940256099942544/2934735716
 *   Android: ca-app-pub-3940256099942544/6300978111
 */

import { View, Text, StyleSheet, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';

// 本番時は環境変数から取得
const TEST_BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';
const TEST_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';

const BANNER_ID = Platform.OS === 'ios' ? TEST_BANNER_ID_IOS : TEST_BANNER_ID_ANDROID;

interface AdBannerProps {
  style?: object;
}

export function AdBanner({ style }: AdBannerProps) {
  const colors = useColors();

  // Web環境ではプレースホルダーを表示
  // ネイティブビルドでは react-native-google-mobile-ads の BannerAd を使用
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
        <Text style={[styles.placeholderText, { color: colors.muted }]}>広告</Text>
      </View>
    );
  }

  // ネイティブ: 動的インポートで BannerAd を使用
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BannerAd, BannerAdSize, TestIds } = require('react-native-google-mobile-ads');
    return (
      <View style={[styles.container, style]}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={() => {}}
        />
      </View>
    );
  } catch {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
        <Text style={[styles.placeholderText, { color: colors.muted }]}>広告</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minHeight: 50,
  },
  placeholder: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 12,
  },
});

export { BANNER_ID };
