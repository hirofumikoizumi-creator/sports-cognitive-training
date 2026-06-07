/**
 * AdBanner コンポーネント
 *
 * iOS は AdMob の本番広告ユニット ID を使用します。
 * Android は未設定のため、Google 公式テスト広告 ID を使用します。
 */

import { View, Text, StyleSheet, Platform } from 'react-native';
import { useColors } from '@/hooks/use-colors';

const BANNER_ID_IOS = 'ca-app-pub-5840457424714744/6697831949';
const INTERSTITIAL_ID_IOS = 'ca-app-pub-5840457424714744/2147908924';
const TEST_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID_ANDROID = 'ca-app-pub-3940256099942544/1033173712';

const BANNER_ID = Platform.OS === 'ios' ? BANNER_ID_IOS : TEST_BANNER_ID_ANDROID;
const INTERSTITIAL_ID = Platform.OS === 'ios' ? INTERSTITIAL_ID_IOS : TEST_INTERSTITIAL_ID_ANDROID;

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
    const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');
    return (
      <View style={[styles.container, style]}>
        <BannerAd
          unitId={BANNER_ID}
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

export { BANNER_ID, INTERSTITIAL_ID };
