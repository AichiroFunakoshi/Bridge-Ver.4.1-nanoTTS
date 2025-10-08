# TTS機能実装の要件定義

**プロジェクト**: Bridge(Ver.4.1-nano) TTS版  
**作成日**: 2025年10月7日  
**バージョン**: 1.0

---

## 📋 機能要件

### 1. 基本機能
- ✅ 翻訳結果が画面に表示された直後に、自動的に音声で読み上げる
- ✅ 日本語→英語翻訳の場合は英語音声で読み上げ
- ✅ 英語→日本語翻訳の場合は日本語音声で読み上げ
- ✅ 既存の音声認識・翻訳機能は一切変更しない

### 2. TTS制御機能
- ✅ TTS機能のON/OFF切り替え（デフォルト: ON）
- ✅ 新しい翻訳が開始されたら、再生中のTTSを自動停止
- ✅ 録音停止ボタンを押したら、TTSも停止
- ✅ ユーザー設定はlocalStorageに保存

### 3. UI要件

#### 追加するUI要素：

**1. 設定モーダル内にTTSトグル**
- 「音声読み上げ」ON/OFFスイッチ
- OpenAI APIキー設定の下に配置

**2. TTS再生中インジケーター**
- 翻訳結果ボックスに「🔊 読み上げ中...」表示
- 既存の「翻訳中...」インジケーターと同様のデザイン

**3. TTS状態の視覚フィードバック**
- 再生中は翻訳ボックスに微妙なアニメーション効果

---

## 🔧 技術仕様

### 使用技術
**Web Speech API** (`window.speechSynthesis`)
- **選定理由**: 
  - ブラウザネイティブ機能
  - 追加APIキー不要
  - 十分な音声品質
  - モバイル対応（iOS Safari、Android Chrome）

### 実装ポイント

#### 1. 音声言語の自動判定
```javascript
const targetLang = selectedLanguage === 'ja' ? 'en-US' : 'ja-JP';
```

#### 2. 音声の基本設定
```javascript
utterance.rate = 1.0;    // 通常速度
utterance.pitch = 1.0;   // 通常ピッチ  
utterance.volume = 1.0;  // 最大音量
```

#### 3. TTS発火タイミング
- `translateText()`関数内のストリーミング完了後
- `reader.read()`ループの`done === true`時点

#### 4. 競合制御
```javascript
// 新しい翻訳開始時
if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
}
```

---

## 📱 ユーザーフロー

### 通常使用時：
1. ユーザーが「開始」ボタンを押す
2. 音声で話す
3. 原文が画面に表示される
4. 翻訳結果が画面に表示される
5. **【新機能】翻訳結果が自動的に音声で読み上げられる**

### TTS無効化したい場合：
1. 設定ボタン（⚙️）をタップ
2. 「音声読み上げ」をOFF
3. 以降、翻訳結果は表示されるが読み上げはされない

---

## 🎯 実装優先順位

### Phase 1: 基本実装（最優先）
- [ ] TTS関数の作成 (`speakTranslation()`)
- [ ] `translateText()`関数へのTTS統合
- [ ] 競合制御（前の音声を停止）
- [ ] 設定モーダルへのON/OFFトグル追加
- [ ] localStorage保存機能

### Phase 2: UI改善
- [ ] TTS再生中インジケーター
- [ ] 翻訳ボックスのアニメーション効果
- [ ] 停止ボタン押下時のTTS停止

### Phase 3: 拡張機能（オプション）
- [ ] 音声速度調整（0.5x, 1.0x, 1.5x, 2.0x）
- [ ] 音量調整スライダー
- [ ] 音声の一時停止/再開機能

---

## ⚠️ 注意事項と制約

### 1. ブラウザ依存性
- iOS SafariとAndroid Chromeで音声品質が異なる
- 一部の古いブラウザではSpeech Synthesis未対応
- 各ブラウザで利用可能な音声エンジンが異なる

### 2. 自動再生ポリシー
- ユーザー操作（ボタンクリック）後でないと音声再生できない場合がある
- 初回は必ずユーザーが「開始」ボタンを押すので問題なし
- バックグラウンド再生の制限に注意

### 3. 連続使用時の挙動
- ユーザーが話し続けると翻訳も連続発生
- 前のTTSを自動キャンセルすることで対処
- デバウンス最適化機能との連携が重要

### 4. パフォーマンス
- ストリーミング翻訳中はTTSを発火させない
- 完全に翻訳が完了してからTTS開始
- メモリリーク防止のため、使用後のUtteranceオブジェクトを適切に破棄

---

## 🔄 既存機能との統合

### 影響を受けない機能
- デバウンス最適化（日本語: 346ms、英語: 154ms）
- 音声認識機能
- OpenAI API翻訳機能
- ストリーミング表示機能
- フォントサイズ調整
- リセット機能

### 連携が必要な機能
- **録音停止ボタン**: TTS再生も同時に停止
- **リセットボタン**: TTS再生を停止してから実行
- **新規翻訳開始**: 前のTTS再生を中断

---

## 📝 実装チェックリスト

### コード変更

#### `app.js`
- [ ] `isTTSEnabled`変数の追加（localStorage連携）
- [ ] `currentSpeechUtterance`変数の追加
- [ ] `speakTranslation(text, language)`関数の実装
- [ ] `translateText()`関数内でTTS呼び出し
- [ ] `stopRecording()`関数でTTS停止処理
- [ ] `resetContent()`関数でTTS停止処理
- [ ] 設定保存・読み込み処理

#### `style.css`
- [ ] `.speaking-indicator`スタイル追加
- [ ] TTS再生中のアニメーション効果
- [ ] トグルスイッチのスタイル

#### `index.html`
- [ ] TTS再生中インジケーター要素追加
- [ ] 設定モーダル内にTTSトグル追加

### テスト項目
- [ ] 日本語→英語のTTS動作確認
- [ ] 英語→日本語のTTS動作確認
- [ ] TTS ON/OFF切り替え動作確認
- [ ] 連続翻訳時のTTS中断動作確認
- [ ] 停止ボタン押下時のTTS停止確認
- [ ] リセットボタン押下時のTTS停止確認
- [ ] localStorage保存・読み込み確認
- [ ] iOS Safariでの動作確認
- [ ] Android Chromeでの動作確認

---

## 📚 参考資料

### Web Speech API - SpeechSynthesis
- [MDN Web Docs - SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
- [MDN Web Docs - SpeechSynthesisUtterance](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance)

### ブラウザ対応状況
- [Can I use - Speech Synthesis](https://caniuse.com/speech-synthesis)

---

## 🔄 更新履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0 | 2025-10-07 | 初版作成 |

---

## 👥 承認

| 役割 | 氏名 | 日付 | 承認 |
|-----|------|------|------|
| プロジェクトオーナー | | | ☐ |
| 技術リード | Claude AI | 2025-10-07 | ☑ |

---

**次のステップ**: 要件定義承認後、Phase 1の実装を開始します。
