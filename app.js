// リアルタイム音声翻訳 - JavaScript（デバウンス最適化版）

// ========================================
// エラーレポートシステム
// ========================================
const ErrorReporter = {
    logs: [],
    maxLogs: 100,
    hasError: false,

    init: function() {
        // console.logをインターセプト
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            this.addLog('log', args);
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            this.addLog('error', args);
            this.hasError = true;
            this.showReportButton();
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            this.addLog('warn', args);
            originalWarn.apply(console, args);
        };

        // グローバルエラーをキャッチ
        window.addEventListener('error', (event) => {
            this.addLog('error', [`グローバルエラー: ${event.message}`, event.filename, event.lineno]);
            this.hasError = true;
            this.showReportButton();
        });

        // Promise rejectionをキャッチ
        window.addEventListener('unhandledrejection', (event) => {
            this.addLog('error', [`未処理のPromise拒否: ${event.reason}`]);
            this.hasError = true;
            this.showReportButton();
        });
    },

    addLog: function(level, args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');

        this.logs.push({
            timestamp,
            level,
            message
        });

        // 最大ログ数を超えたら古いものを削除
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    },

    showReportButton: function() {
        const existingButton = document.getElementById('errorReportButton');
        if (existingButton) return; // 既に表示済み

        const button = document.createElement('button');
        button.id = 'errorReportButton';
        button.className = 'error-report-button';
        button.innerHTML = '⚠️ エラーを報告';
        button.onclick = () => this.generateReport();
        document.body.appendChild(button);
    },

    generateReport: function() {
        const report = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            windowSize: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href,
            logs: this.logs.slice(-50) // 最新50件
        };

        // レポート内容をモーダルで表示
        this.showReportModal(report);
    },

    showReportModal: function(report) {
        const modal = document.createElement('div');
        modal.className = 'error-report-modal';
        modal.innerHTML = `
            <div class="error-report-content">
                <h2>エラーレポート</h2>
                <p>以下の内容が報告されます：</p>
                <textarea readonly>${JSON.stringify(report, null, 2)}</textarea>
                <div class="error-report-buttons">
                    <button id="copyReportBtn">コピー</button>
                    <button id="sendReportBtn">GitHubで報告</button>
                    <button id="closeReportBtn">キャンセル</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // コピーボタン
        document.getElementById('copyReportBtn').onclick = () => {
            navigator.clipboard.writeText(JSON.stringify(report, null, 2));
            alert('レポートをクリップボードにコピーしました');
        };

        // GitHub報告ボタン
        document.getElementById('sendReportBtn').onclick = () => {
            this.openGitHubIssue(report);
        };

        // 閉じるボタン
        document.getElementById('closeReportBtn').onclick = () => {
            modal.remove();
        };
    },

    openGitHubIssue: function(report) {
        const title = encodeURIComponent('エラーレポート: TTS機能の問題');
        const body = encodeURIComponent(
            `## エラーレポート\n\n` +
            `**発生日時**: ${report.timestamp}\n\n` +
            `**環境情報**:\n` +
            `- ブラウザ: ${report.userAgent}\n` +
            `- プラットフォーム: ${report.platform}\n` +
            `- 言語: ${report.language}\n` +
            `- 画面サイズ: ${report.screenSize}\n\n` +
            `**ログ**:\n\`\`\`json\n${JSON.stringify(report.logs, null, 2)}\n\`\`\`\n\n` +
            `**再現手順**:\n` +
            `1. \n` +
            `2. \n` +
            `3. \n\n` +
            `**期待される動作**:\n\n` +
            `**実際の動作**:\n`
        );

        const issueUrl = `https://github.com/AichiroFunakoshi/Bridge-Ver.4.1-nanoTTS/issues/new?title=${title}&body=${body}`;
        window.open(issueUrl, '_blank');
    }
};

// エラーレポートシステムを初期化
ErrorReporter.init();

// ========================================
// メインアプリケーション
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    // デフォルトAPIキー
    const DEFAULT_OPENAI_API_KEY = '';

    // APIキー保存
    let OPENAI_API_KEY = '';

    // TTS関連変数
    let isTTSEnabled = true; // デフォルトでTTS有効
    let currentSpeechUtterance = null; // 現在再生中の音声
    let isTTSPlaying = false; // TTS再生中フラグ
    let ttsInitialized = false; // iOS Safari用: TTS初期化済みフラグ
    
    // DOM要素
    const startJapaneseBtn = document.getElementById('startJapaneseBtn');
    const startEnglishBtn = document.getElementById('startEnglishBtn');
    const stopBtn = document.getElementById('stopBtn');
    const stopBtnText = document.getElementById('stopBtnText');
    const resetBtn = document.getElementById('resetBtn');
    const status = document.getElementById('status');
    const errorMessage = document.getElementById('errorMessage');
    const originalText = document.getElementById('originalText');
    const translatedText = document.getElementById('translatedText');
    const sourceLanguage = document.getElementById('sourceLanguage');
    const targetLanguage = document.getElementById('targetLanguage');
    const apiModal = document.getElementById('apiModal');
    const settingsButton = document.getElementById('settingsButton');
    const openaiKeyInput = document.getElementById('openaiKey');
    const saveApiKeysBtn = document.getElementById('saveApiKeys');
    const resetKeysBtn = document.getElementById('resetKeys');
    const listeningIndicator = document.getElementById('listeningIndicator');
    const translatingIndicator = document.getElementById('translatingIndicator');
    const speakingIndicator = document.getElementById('speakingIndicator');
    const ttsToggle = document.getElementById('ttsToggle');
    const fontSizeSmallBtn = document.getElementById('fontSizeSmall');
    const fontSizeMediumBtn = document.getElementById('fontSizeMedium');
    const fontSizeLargeBtn = document.getElementById('fontSizeLarge');
    const fontSizeXLargeBtn = document.getElementById('fontSizeXLarge');
    const translationBox = document.getElementById('translationBox');
    const tapHint = document.getElementById('tapHint');
    const fontSizePreview = document.getElementById('fontSizePreview');
    
    // 音声認識変数
    let recognition = null;
    let isRecording = false;
    let currentTranslationController = null;
    let translationInProgress = false;
    let selectedLanguage = ''; // 'ja' は日本語、'en' は英語
    let lastTranslationTime = 0;
    let isRecognitionRunning = false; // 音声認識が実行中かどうか

    // 重複防止のための変数
    let processedResultIds = new Set(); // 処理済みの結果IDを追跡
    let lastTranslatedText = ''; // 最後に翻訳した内容を記録
    let translationDebounceTimer = null;

    // TTS用の最終翻訳結果を保存
    let lastTranslationResult = '';

    // アプリ初期化フラグ（イベントリスナー重複登録防止）
    let appInitialized = false;

    // 言語別最適デバウンス設定（科学的アプローチに基づく）
    const OPTIMAL_DEBOUNCE = {
        'ja': 346,  // 日本語最適値（文節区切り対応・31%改善）
        'en': 154   // 英語最適値（流暢性追従・69%改善）
    };

    // 動的デバウンス取得関数
    const getOptimalDebounce = (selectedLanguage) => {
        return OPTIMAL_DEBOUNCE[selectedLanguage] || 300; // デフォルト値
    };

    // 日本語文字起こしの整形に使用する変数と関数
    let japaneseFormatter = {
        // 文章の最後に句点を追加する
        addPeriod: function(text) {
            if (text && !text.endsWith("。") && !text.endsWith(".") && !text.endsWith("？") && !text.endsWith("?") && !text.endsWith("！") && !text.endsWith("!")) {
                return text + "。";
            }
            return text;
        },
        
        // 適切な位置に読点を追加する
        addCommas: function(text) {
            // 文中の自然な区切りに読点を追加する簡易的なルール
            // 接続詞や特定のパターンの後に読点を追加
            const patterns = [
                { search: /([^、。])そして/g, replace: "$1、そして" },
                { search: /([^、。])しかし/g, replace: "$1、しかし" },
                { search: /([^、。])ですが/g, replace: "$1、ですが" },
                { search: /([^、。])また/g, replace: "$1、また" },
                { search: /([^、。])けれども/g, replace: "$1、けれども" },
                { search: /([^、。])だから/g, replace: "$1、だから" },
                { search: /([^、。])ので/g, replace: "$1、ので" },
                // 文が長い場合、適度に区切る
                { search: /(.{10,})から(.{10,})/g, replace: "$1から、$2" },
                { search: /(.{10,})ので(.{10,})/g, replace: "$1ので、$2" },
                { search: /(.{10,})けど(.{10,})/g, replace: "$1けど、$2" }
            ];
            
            let result = text;
            for (const pattern of patterns) {
                result = result.replace(pattern.search, pattern.replace);
            }
            
            return result;
        },
        
        // 文章全体を整形する
        format: function(text) {
            if (!text || text.trim().length === 0) return text;
            
            let formatted = text;
            // まず読点を追加
            formatted = this.addCommas(formatted);
            // 次に文末に句点を追加
            formatted = this.addPeriod(formatted);
            
            return formatted;
        }
    };
    
    // iOS Safari用: TTS初期化関数
    function initializeTTSForIOS() {
        if (ttsInitialized) return;

        console.log('iOS Safari用TTS初期化を実行');

        // ダミー音声を再生してSpeech Synthesisを初期化
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0; // 無音
        window.speechSynthesis.speak(utterance);

        ttsInitialized = true;
        console.log('TTS初期化完了');
    }

    // TTS機能: 翻訳結果を音声で読み上げ
    function speakTranslation(text, language) {
        console.log('speakTranslation呼び出し:', {
            text: text ? text.substring(0, 50) + '...' : 'null',
            language: language,
            isTTSEnabled: isTTSEnabled,
            ttsInitialized: ttsInitialized,
            speechSynthesisAvailable: 'speechSynthesis' in window
        });

        // TTS無効の場合は何もしない
        if (!isTTSEnabled) {
            console.log('TTS無効: isTTSEnabled = false');
            return;
        }

        if (!text || !text.trim()) {
            console.log('TTS無効: テキストが空');
            return;
        }

        // Web Speech API対応確認
        if (!('speechSynthesis' in window)) {
            console.warn('このブラウザはWeb Speech API (TTS)に対応していません');
            return;
        }

        // iOS Safari対策: 初期化されていない場合は初期化
        if (!ttsInitialized) {
            console.warn('TTS未初期化: ユーザー操作時に初期化されていません');
            initializeTTSForIOS();
        }

        // 前の音声を停止
        if (window.speechSynthesis.speaking) {
            console.log('前のTTS再生を停止');
            window.speechSynthesis.cancel();
        }

        // TTS再生中フラグを立てる
        isTTSPlaying = true;

        // 音声認識を一時停止（TTSの音声を拾わないようにするため）
        if (isRecording && recognition && isRecognitionRunning) {
            try {
                console.log('TTS再生のため音声認識を一時停止');
                recognition.stop();
            } catch (e) {
                console.error('音声認識の停止に失敗:', e?.message || e);
            }
        }

        // 新しい音声合成オブジェクトを作成
        const utterance = new SpeechSynthesisUtterance(text);

        // 言語設定（日本語→英語翻訳なら英語で、英語→日本語翻訳なら日本語で読み上げ）
        utterance.lang = language === 'ja' ? 'en-US' : 'ja-JP';

        console.log('TTS設定:', {
            lang: utterance.lang,
            textLength: text.length
        });

        // 音声設定
        utterance.rate = 1.0;    // 通常速度
        utterance.pitch = 1.0;   // 通常ピッチ
        utterance.volume = 1.0;  // 最大音量

        // イベントハンドラ
        utterance.onstart = function() {
            console.log('✓ TTS再生開始:', language === 'ja' ? '英語' : '日本語');
            if (speakingIndicator) {
                speakingIndicator.classList.add('visible');
            }
            updateTTSPlayingState(true);
        };

        utterance.onend = function() {
            console.log('✓ TTS再生終了');
            if (speakingIndicator) {
                speakingIndicator.classList.remove('visible');
            }
            currentSpeechUtterance = null;
            isTTSPlaying = false;
            updateTTSPlayingState(false);

            // TTS終了後、録音中であれば音声認識を再開
            safeRestartRecognition(200, 'TTS終了');
        };

        utterance.onerror = function(event) {
            console.error('✗ TTS再生エラー:', event.error, event);
            if (speakingIndicator) {
                speakingIndicator.classList.remove('visible');
            }
            currentSpeechUtterance = null;
            isTTSPlaying = false;
            updateTTSPlayingState(false);

            // エラー時も音声認識を再開
            safeRestartRecognition(200, 'TTSエラー後');
        };

        // 音声を再生
        currentSpeechUtterance = utterance;
        console.log('window.speechSynthesis.speak() を呼び出し');
        window.speechSynthesis.speak(utterance);

        // 再生キューの状態を確認
        setTimeout(() => {
            console.log('TTS状態確認:', {
                speaking: window.speechSynthesis.speaking,
                pending: window.speechSynthesis.pending,
                paused: window.speechSynthesis.paused
            });
        }, 100);
    }
    
    // TTS停止関数
    function stopTTS() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        if (speakingIndicator) {
            speakingIndicator.classList.remove('visible');
        }
        currentSpeechUtterance = null;
        isTTSPlaying = false;
        updateTTSPlayingState(false);
        console.log('TTS停止');
    }

    // 音声認識を安全に再開するヘルパー関数
    function safeRestartRecognition(delayMs = 100, source = '') {
        if (!isRecording || !recognition) {
            return;
        }
        setTimeout(() => {
            if (isRecording && !isRecognitionRunning && !isTTSPlaying) {
                try {
                    console.log(`音声認識を再開${source ? ' (' + source + ')' : ''}`);
                    recognition.start();
                } catch (e) {
                    console.error('音声認識の再開に失敗:', e?.message || e);
                    // 既に実行中の場合は無視（DOMException.nameまたはメッセージで判定）
                    if (e?.name === 'InvalidStateError' || e?.message?.includes('already started')) {
                        isRecognitionRunning = true;
                    }
                }
            }
        }, delayMs);
    }

    // 翻訳ボックスの状態を更新（タップ可能表示）
    function updateTranslationBoxState(hasContent) {
        if (translationBox) {
            // TTS有効かつコンテンツがある場合のみタップ可能
            const shouldEnable = hasContent && isTTSEnabled;
            if (shouldEnable) {
                translationBox.classList.add('has-content');
            } else {
                translationBox.classList.remove('has-content');
            }
        }
    }

    // TTS再生中の視覚的フィードバックを更新
    function updateTTSPlayingState(isPlaying) {
        if (translationBox) {
            if (isPlaying) {
                translationBox.classList.add('tts-playing');
            } else {
                translationBox.classList.remove('tts-playing');
            }
        }
    }

    // 手動TTS再生関数（再生ボタン用）
    function playTranslation() {
        // iOS Safari対策: ユーザーのタップ時にTTSを初期化
        if (!ttsInitialized && 'speechSynthesis' in window) {
            initializeTTSForIOS();
        }

        if (!lastTranslationResult || !lastTranslationResult.trim()) {
            console.log('再生する翻訳結果がありません');
            return;
        }

        // TTS再生中なら停止し、録音中であれば音声認識を再開
        if (isTTSPlaying) {
            stopTTS();
            safeRestartRecognition(200, 'TTS手動停止');
            return;
        }

        console.log('手動TTS再生を開始:', lastTranslationResult.substring(0, 50) + '...');
        speakTranslation(lastTranslationResult, selectedLanguage);
    }

    // APIキー読み込み
    function loadApiKeys() {
        const storedOpenaiKey = localStorage.getItem('translatorOpenaiKey');

        OPENAI_API_KEY = storedOpenaiKey ? storedOpenaiKey.trim() : '';

        // TTS設定を読み込み
        const storedTTSEnabled = localStorage.getItem('translatorTTSEnabled');
        if (storedTTSEnabled !== null) {
            isTTSEnabled = storedTTSEnabled === 'true';
        } else {
            // デフォルトでTTS有効
            isTTSEnabled = true;
        }

        console.log('TTS設定読み込み:', {
            isTTSEnabled: isTTSEnabled,
            storedValue: storedTTSEnabled
        });

        if (!OPENAI_API_KEY) {
            openaiKeyInput.value = DEFAULT_OPENAI_API_KEY;
            apiModal.style.display = 'flex';
        } else {
            initializeApp();
        }
    }
    
    // APIキー保存
    saveApiKeysBtn.addEventListener('click', () => {
        const openaiKey = openaiKeyInput.value.trim();
        
        if (!openaiKey) {
            alert('OpenAI APIキーを入力してください。');
            return;
        }
        
        // APIキーを保存する前に不要なスペースを確実に削除
        localStorage.setItem('translatorOpenaiKey', openaiKey.trim());
        
        OPENAI_API_KEY = openaiKey.trim();
        
        // TTS設定も保存
        if (ttsToggle) {
            isTTSEnabled = ttsToggle.checked;
            localStorage.setItem('translatorTTSEnabled', isTTSEnabled.toString());
        }
        
        apiModal.style.display = 'none';
        initializeApp();
    });
    
    // 設定モーダルを開く
    settingsButton.addEventListener('click', () => {
        openaiKeyInput.value = OPENAI_API_KEY;
        if (ttsToggle) {
            ttsToggle.checked = isTTSEnabled;
        }
        apiModal.style.display = 'flex';
    });
    
    // APIキーリセット
    resetKeysBtn.addEventListener('click', () => {
        if (confirm('APIキーをリセットしますか？')) {
            localStorage.removeItem('translatorOpenaiKey');
            localStorage.removeItem('translatorTTSEnabled');
            location.reload();
        }
    });
    
    // モーダル外クリックで閉じる
    apiModal.addEventListener('click', (e) => {
        if (e.target === apiModal) {
            apiModal.style.display = 'none';
        }
    });
    
    // TTS設定の変更を監視
    if (ttsToggle) {
        ttsToggle.addEventListener('change', () => {
            isTTSEnabled = ttsToggle.checked;
            localStorage.setItem('translatorTTSEnabled', isTTSEnabled.toString());
            console.log('TTS設定変更:', isTTSEnabled ? '有効' : '無効');
            // TTS設定変更時に再生ボタンの状態を更新
            updateTranslationBoxState(!!lastTranslationResult);
        });
    }

    // フォントサイズ変更ボタンの設定（モーダル内でAPIキー入力前から使えるように早期バインド）
    if (fontSizeSmallBtn) fontSizeSmallBtn.addEventListener('click', () => changeFontSize('small'));
    if (fontSizeMediumBtn) fontSizeMediumBtn.addEventListener('click', () => changeFontSize('medium'));
    if (fontSizeLargeBtn) fontSizeLargeBtn.addEventListener('click', () => changeFontSize('large'));
    if (fontSizeXLargeBtn) fontSizeXLargeBtn.addEventListener('click', () => changeFontSize('xlarge'));

    // 保存されたフォントサイズ設定を早期適用（APIキー入力前から反映）
    const initialFontSize = localStorage.getItem('translatorFontSize') || 'medium';
    changeFontSize(initialFontSize);

    // フォントサイズプレビューの更新関数
    function updateFontSizePreview(size) {
        if (!fontSizePreview) return;

        // サイズに応じたフォントサイズを設定
        const fontSizes = {
            'small': '14px',
            'medium': '18px',
            'large': '24px',
            'xlarge': '32px'
        };

        const previewText = fontSizePreview.querySelector('.preview-text');
        if (previewText) {
            previewText.style.fontSize = fontSizes[size] || '18px';
        }

        // ボタンのアクティブ状態を更新
        [fontSizeSmallBtn, fontSizeMediumBtn, fontSizeLargeBtn, fontSizeXLargeBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        const buttonMap = {
            'small': fontSizeSmallBtn,
            'medium': fontSizeMediumBtn,
            'large': fontSizeLargeBtn,
            'xlarge': fontSizeXLargeBtn
        };

        if (buttonMap[size]) {
            buttonMap[size].classList.add('active');
        }
    }

    // フォントサイズ変更関数
    function changeFontSize(size) {
        // すべてのサイズクラスを削除
        originalText.classList.remove('size-small', 'size-medium', 'size-large', 'size-xlarge');
        translatedText.classList.remove('size-small', 'size-medium', 'size-large', 'size-xlarge');

        // 選択されたサイズクラスを追加
        originalText.classList.add(`size-${size}`);
        translatedText.classList.add(`size-${size}`);

        // ローカルストレージに保存してユーザー設定を記憶
        localStorage.setItem('translatorFontSize', size);

        // プレビューも更新
        updateFontSizePreview(size);
    }
    
    // アプリの初期化
    function initializeApp() {
        // エラーメッセージをクリア
        errorMessage.textContent = '';

        // Web Speech APIのサポート確認
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            setupSpeechRecognition();
        } else {
            status.textContent = 'このブラウザは音声認識に対応していません。';
            status.classList.remove('idle');
            status.classList.add('error');
            errorMessage.textContent = 'ブラウザが音声認識に対応していません。Chrome、Safari、またはEdgeをお使いください。';
            return;
        }

        // TTS対応確認
        if (!('speechSynthesis' in window)) {
            console.warn('このブラウザはTTSに対応していません');
        }

        // TTS設定の初期化
        if (ttsToggle) {
            ttsToggle.checked = isTTSEnabled;
        }

        // 既に初期化済みの場合はイベントリスナーを再登録しない
        if (appInitialized) {
            console.log('アプリは既に初期化済みです。イベントリスナーの再登録をスキップします。');
            return;
        }

        // 言語ボタンを有効化
        startJapaneseBtn.addEventListener('click', () => startRecording('ja'));
        startEnglishBtn.addEventListener('click', () => startRecording('en'));
        stopBtn.addEventListener('click', stopRecording);
        resetBtn.addEventListener('click', resetContent);

        // 翻訳ボックスのタップ/キーボードでTTS再生
        if (translationBox) {
            translationBox.addEventListener('click', playTranslation);
            // キーボードアクセシビリティ対応（Enter/Space）
            translationBox.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    playTranslation();
                }
            });
            // 初期状態は無効
            updateTranslationBoxState(false);
        }

        // 翻訳システムプロンプト
        window.SYSTEM_PROMPT = `あなたは日本語と英語の専門的な同時通訳者です。
音声入力データを以下のルールに従って読みやすいテキストに変換して翻訳してください：

1. 元のテキストが日本語の場合は英語に翻訳する。
2. 元のテキストが英語の場合は日本語に翻訳する。
3. 「えー」「うー」などのフィラーや冗長な表現は除去する。
4. データが不足している場合は文脈に基づいて補完する。
5. 専門用語、固有名詞、文化的な言及は正確に保持する。
6. 出力は自然で会話的にする。
7. 翻訳のみを出力し、説明は含めない。`;

        // 初期化完了フラグを設定
        appInitialized = true;
        console.log('アプリ初期化完了');
    }
    
    // コンテンツリセット機能
    function resetContent() {
        // TTS停止
        stopTTS();

        // リセット処理
        processedResultIds.clear();
        lastTranslatedText = '';
        lastTranslationResult = ''; // TTS用の翻訳結果もクリア
        originalText.textContent = '';
        translatedText.textContent = '';

        // 再生ボタンを無効化
        updateTranslationBoxState(false);
        
        // ステータス表示も更新
        status.textContent = '待機中';
        status.classList.remove('recording', 'processing', 'error');
        status.classList.add('idle');
        
        errorMessage.textContent = '';
        
        console.log('コンテンツリセット完了');
    }
    
    // 音声認識の設定
    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            status.textContent = 'このブラウザは音声認識に対応していません。';
            status.classList.remove('idle');
            status.classList.add('error');
            errorMessage.textContent = 'ブラウザが音声認識に対応していません。Chrome、Safari、またはEdgeをお使いください。';
            return;
        }
        
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        recognition.onstart = function() {
            console.log('音声認識開始。言語:', recognition.lang);
            isRecognitionRunning = true;
            listeningIndicator.classList.add('visible');
        };

        recognition.onend = function() {
            console.log('音声認識終了');
            isRecognitionRunning = false;
            listeningIndicator.classList.remove('visible');

            // 録音中の場合のみ再開を検討
            if (isRecording) {
                // TTS再生中は再開しない
                if (isTTSPlaying) {
                    console.log('TTS再生中のため音声認識は再開しない');
                    return;
                }

                // 少し遅延を入れて再開（連続再開を防ぐ）
                safeRestartRecognition(100, 'onend');
            }
        };
        
        // 音声認識結果の処理 - デバウンス最適化版
        recognition.onresult = function(event) {
            // 現在の文字起こし内容を構築
            let interimText = '';
            let finalText = '';
            let hasNewContent = false;
            
            // 各認識結果に対して処理
            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript.trim();
                
                // 各結果に一意のIDを生成（位置＋内容）
                const resultId = `${i}-${transcript}`;
                
                // 確定した結果の場合
                if (result.isFinal) {
                    // まだ処理していない結果の場合のみ追加
                    if (!processedResultIds.has(resultId)) {
                        processedResultIds.add(resultId);
                        hasNewContent = true;
                        
                        // 日本語入力の場合、文章を整形
                        if (selectedLanguage === 'ja') {
                            finalText += japaneseFormatter.format(transcript) + ' ';
                        } else {
                            finalText += transcript + ' ';
                        }
                    } else {
                        // 処理済みの確定結果も表示用には追加
                        finalText += transcript + ' ';
                    }
                } else {
                    // 暫定結果
                    interimText += transcript + ' ';
                    hasNewContent = true;
                }
            }
            
            // 表示テキスト (確定結果 + 暫定結果)
            const displayText = (finalText + interimText).trim();
            
            // UIを更新
            originalText.textContent = displayText;
            
            // 言語インジケータを更新
            if (selectedLanguage === 'ja') {
                sourceLanguage.textContent = '日本語';
                targetLanguage.textContent = '英語';
            } else {
                sourceLanguage.textContent = '英語';
                targetLanguage.textContent = '日本語';
            }
            
            // 新しいコンテンツがある場合、翻訳をトリガー
            if (hasNewContent && displayText !== lastTranslatedText) {
                // 翻訳処理をデバウンス（言語に応じて動的調整）
                clearTimeout(translationDebounceTimer);
                const dynamicDebounce = getOptimalDebounce(selectedLanguage);
                translationDebounceTimer = setTimeout(() => {
                    lastTranslatedText = displayText;
                    translateText(displayText);
                }, dynamicDebounce); // 言語に応じて動的変更
            }
        };
        
        recognition.onerror = function(event) {
            // no-speechとabortedは正常な状態として扱う
            if (event.error === 'no-speech') {
                // 音声が検出されない - 正常な状態
                console.log('音声認識: 音声が検出されません');
            } else if (event.error === 'aborted') {
                // TTS再生等のために意図的に停止された - 正常な状態
                console.log('音声認識が中断されました（意図的な停止）');
            } else if (event.error === 'audio-capture') {
                console.error('音声認識エラー:', event.error);
                status.textContent = 'マイクが検出されません';
                status.classList.remove('idle', 'recording');
                status.classList.add('error');
                errorMessage.textContent = 'マイクが検出できません。デバイス設定を確認してください。';
                stopRecording();
            } else if (event.error === 'not-allowed') {
                console.error('音声認識エラー:', event.error);
                status.textContent = 'マイク権限が拒否されています';
                status.classList.remove('idle', 'recording');
                status.classList.add('error');
                errorMessage.textContent = 'マイクアクセスが拒否されました。ブラウザ設定でマイク権限を許可してください。';
                stopRecording();
            } else {
                // その他の未知のエラー
                console.error('音声認識エラー:', event.error);
            }
        };
    }
    
    // 録音状態のボタン表示切り替え
    function updateButtonVisibility(isRecordingState) {
        if (isRecordingState) {
            // 開始ボタンを非表示、停止ボタンを表示
            startJapaneseBtn.style.display = 'none';
            startEnglishBtn.style.display = 'none';
            stopBtn.style.display = 'flex';
            stopBtn.disabled = false;
            resetBtn.disabled = true; // 録音中はリセット無効化
            resetBtn.style.opacity = '0.5';
        } else {
            // 開始ボタンを表示、停止ボタンを非表示
            startJapaneseBtn.style.display = 'flex';
            startEnglishBtn.style.display = 'flex';
            startJapaneseBtn.disabled = false;
            startEnglishBtn.disabled = false;
            stopBtn.style.display = 'none';
            stopBtn.disabled = true;
            resetBtn.disabled = false; // 録音停止中はリセット有効化
            resetBtn.style.opacity = '1';
        }
    }
    
    // 指定された言語で録音開始
    async function startRecording(language) {
        // iOS Safari対策: ユーザーのタップ時にTTSを初期化
        if (!ttsInitialized && 'speechSynthesis' in window) {
            initializeTTSForIOS();
        }

        // エラーメッセージをクリア
        errorMessage.textContent = '';

        // 選択言語を設定
        selectedLanguage = language;

        // UIと変数をリセット
        processedResultIds.clear();
        lastTranslatedText = '';
        lastTranslationResult = ''; // 前回の翻訳結果をクリア
        originalText.textContent = '';
        translatedText.textContent = '';

        // 再生ボタンを無効化
        updateTranslationBoxState(false);

        // TTS停止
        stopTTS();
        
        // 言語インジケータを更新
        if (language === 'ja') {
            sourceLanguage.textContent = '日本語';
            targetLanguage.textContent = '英語';
            // 停止ボタンのテキストを日本語に設定
            stopBtnText.textContent = '停止';
        } else {
            sourceLanguage.textContent = '英語';
            targetLanguage.textContent = '日本語';
            // 停止ボタンのテキストを英語に設定
            stopBtnText.textContent = 'Stop';
        }
        
        // UIを更新
        isRecording = true;
        document.body.classList.add('recording');
        status.textContent = '録音中';
        status.classList.remove('idle', 'error');
        status.classList.add('recording');
        
        // ボタン表示を更新 - 開始ボタンを非表示、停止ボタンを表示
        updateButtonVisibility(true);
        
        // Web Speech APIを使用して言語を明示的に設定
        try {
            // 認識言語を設定
            recognition.lang = language === 'ja' ? 'ja-JP' : 'en-US';
            recognition.start();
        } catch (e) {
            console.error('音声認識開始エラー', e);
            errorMessage.textContent = '音声認識の開始に失敗しました: ' + (e?.message || e);
            stopRecording();
        }
    }
    
    // 録音停止
    function stopRecording() {
        isRecording = false;
        document.body.classList.remove('recording');
        status.textContent = '処理中';
        status.classList.remove('recording');
        status.classList.add('processing');
        
        // TTS停止
        stopTTS();
        
        // ボタン表示を更新 - 開始ボタンを表示、停止ボタンを非表示
        updateButtonVisibility(false);
        
        try {
            recognition.stop();
        } catch (e) {
            console.error('音声認識停止エラー', e);
        }
        
        // 処理完了後にステータスを更新
        setTimeout(() => {
            status.textContent = '待機中';
            status.classList.remove('processing');
            status.classList.add('idle');
        }, 1000);
        
        console.log('録音停止');
    }
    
    // OpenAI API（gpt-4.1-nanoモデル）を使用してテキストを翻訳
    async function translateText(text) {
        // 翻訳処理の実行条件をチェック
        if (!text || !text.trim()) {
            console.log('翻訳スキップ: 空のテキスト');
            return;
        }
        
        // 既に翻訳中の場合は新しいリクエストで上書き
        if (translationInProgress) {
            // 既存のリクエストを中断
            if (currentTranslationController) {
                currentTranslationController.abort();
                currentTranslationController = null;
            }
            // 前のTTSも停止
            stopTTS();
        }
        
        translationInProgress = true;
        lastTranslationTime = Date.now();
        translatingIndicator.classList.add('visible');
        
        // エラーメッセージをクリア
        errorMessage.textContent = '';
        
        try {
            // 選択された言語ボタンに基づいて元言語を決定
            const sourceLanguageStr = selectedLanguage === 'ja' ? '日本語' : '英語';
            
            // 新しいAbortControllerを作成
            currentTranslationController = new AbortController();
            const signal = currentTranslationController.signal;
            
            console.log(`テキスト翻訳中 (${text.length} 文字): "${text.substring(0, 30)}..."`);
            
            // gpt-4.1-nanoモデルを使用したOpenAIリクエストを作成
            const translationPayload = {
                model: "gpt-4.1-nano",
                messages: [
                    {
                        role: "system",
                        content: window.SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: `以下の${sourceLanguageStr}テキストを翻訳してください:\n\n${text}`
                    }
                ],
                stream: true,  // リアルタイムレスポンスのためストリーミングを有効化
                temperature: 0.3  // 翻訳精度向上のため低めの値を設定
            };
            
            console.log('OpenAI APIに翻訳リクエストを送信中...');
            
            // 翻訳リクエスト
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + OPENAI_API_KEY.trim()
                },
                body: JSON.stringify(translationPayload),
                signal: signal
            });
            
            if (!response.ok) {
                let errorData = null;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { error: { message: `HTTPエラー: ${response.status}` } };
                }
                
                console.error('OpenAI APIエラー:', errorData);
                throw new Error(errorData.error?.message || `OpenAI APIがステータスを返しました: ${response.status}`);
            }
            
            console.log('翻訳ストリーム開始');
            
            // ストリーミングレスポンスを処理
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let translationResult = '';
            
            // 新しい翻訳開始時は以前の内容をクリア
            translatedText.textContent = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                // チャンクをデコード
                const chunk = decoder.decode(value);
                
                // チャンクから各行を処理
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                const content = data.choices[0].delta.content;
                                translationResult += content;
                                translatedText.textContent = translationResult;
                            }
                        } catch (e) {
                            console.error('ストリーミングレスポンス解析エラー:', e);
                        }
                    }
                }
            }
            
            console.log('翻訳完了:', {
                resultLength: translationResult.length,
                selectedLanguage: selectedLanguage
            });

            // 翻訳結果を保存（手動TTS再生用）
            if (translationResult && translationResult.trim()) {
                lastTranslationResult = translationResult;
                // 再生ボタンを有効化
                updateTranslationBoxState(true);
                console.log('翻訳結果を保存しました。再生ボタンで読み上げ可能です。');
            } else {
                lastTranslationResult = '';
                updateTranslationBoxState(false);
            }

            // 現在のコントローラーをリセット
            currentTranslationController = null;
            
        } catch (error) {
            // 中断エラーは無視
            if (error.name === 'AbortError') {
                console.log('翻訳リクエストが中断されました');
            } else {
                console.error('翻訳エラー:', error);
                errorMessage.textContent = error.message;
                if (translatedText.textContent === '') {
                    translatedText.textContent = '(翻訳エラー - 再度お試しください)';
                }
            }
        } finally {
            translationInProgress = false;
            translatingIndicator.classList.remove('visible');
        }
    }
    
    // アプリ初期化
    loadApiKeys();
});
