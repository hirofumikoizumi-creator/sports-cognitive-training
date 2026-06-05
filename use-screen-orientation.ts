import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform } from 'react-native';

/**
 * 画面向きを一時的にロックするフック
 * @param orientation ロックする向き ('PORTRAIT' | 'LANDSCAPE')
 */
export function useScreenOrientation(orientation: 'PORTRAIT' | 'LANDSCAPE') {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const lockOrientation = async () => {
      try {
        if (orientation === 'LANDSCAPE') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
        }
      } catch (error) {
        console.warn('Failed to lock orientation:', error);
      }
    };

    lockOrientation();

    return () => {
      // クリーンアップ時に向きをリセット
      (async () => {
        try {
          await ScreenOrientation.unlockAsync();
        } catch (error) {
          console.warn('Failed to unlock orientation:', error);
        }
      })();
    };
  }, [orientation]);
}
