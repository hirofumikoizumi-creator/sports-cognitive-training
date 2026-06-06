# App Store Connect / TestFlight 手順

このプロジェクトは Expo / EAS Build で iOS ビルドを作成し、App Store Connect へ提出します。

## 1. Apple 側で先に作るもの

- Apple Developer Program の有効なメンバーシップ
- App Store Connect の新規アプリ
  - App name: `スポ認トレ`
  - Bundle ID: `com.hirofumikoizumi.sportscognitivetraining`
  - SKU: `sports-cognitive-training`
  - Platform: iOS
- App Privacy の回答
- 13 歳未満向けではない場合は、年齢制限を通常どおり設定

## 2. 初回セットアップ

```bash
npm install
npx eas-cli login
npx eas-cli build:configure
```

`eas build:configure` で既存設定を聞かれた場合は、現在の `eas.json` を維持してください。

## 3. 事前チェック

```bash
npm run typecheck
npm test
npx expo-doctor
```

## 4. App Store Connect へアップロード

```bash
npm run testflight
```

または、ビルドと提出を分ける場合:

```bash
npm run build:ios
npm run submit:ios
```

## 5. TestFlight

App Store Connect で処理完了後、TestFlight タブから内部テスターへ配信します。

外部テスターへ配信する場合は Apple の Beta App Review が必要です。

## 注意

- AdMob は現在 Google のテスト App ID / 広告ユニット ID です。本番公開前に実 ID へ差し替えてください。
- カメラを使用するため、App Privacy と権限説明文は実際の用途と一致させてください。
- App Store 審査提出前には、実機でトレーニング開始から結果保存まで確認してください。
