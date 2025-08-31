// いいねボタンの監視を設定
function setupLikeButtonObserver() {
    // MutationObserverの設定
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                checkForLikeButtons();
            }
        });
    });

    // 監視の開始
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 初期チェック
    checkForLikeButtons();
}

// いいねボタンを検索して拡張機能のUIを追加
function checkForLikeButtons() {
    // いいねボタンを探す（X/Twitterの属性セレクタを使用）
    const likeButtons = document.querySelectorAll('[data-testid="like"]');
    
    likeButtons.forEach(button => {
        // 既に処理済みのボタンはスキップ
        if (button.dataset.xsheetProcessed) return;
        
        // ボタンを処理済みとしてマーク
        button.dataset.xsheetProcessed = 'true';
        
        // いいねイベントのリスナーを追加
        button.addEventListener('click', handleLikeButtonClick);
    });
}

// いいねボタンクリック時の処理
async function handleLikeButtonClick(event) {
    // いいねされた要素から投稿データを取得
    const tweetElement = event.target.closest('article');
    if (!tweetElement) return;

    const tweetData = extractTweetData(tweetElement);
    if (!tweetData) return;

    // シート選択モーダルを表示
    showSheetSelectionModal(tweetData);
}

// ツイートデータの抽出
function extractTweetData(tweetElement) {
    try {
        // ツイートのテキストを取得
        const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
        const tweetText = tweetTextElement ? tweetTextElement.textContent : '';

        // ツイートのURLを取得（複数の方法で試行）
        let tweetUrl = '';
        let tweetId = '';

        // 方法1: 時間要素のリンクから取得
        const timeLink = tweetElement.querySelector('time').closest('a');
        if (timeLink) {
            tweetUrl = timeLink.href;
            tweetId = tweetUrl.split('/status/')[1];
        }

        // 方法2: status/を含むリンクを探す
        if (!tweetUrl) {
            const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
            if (tweetLink) {
                tweetUrl = tweetLink.href;
                tweetId = tweetUrl.split('/status/')[1];
            }
        }

        // 方法3: article要素のaria-labeledbyから取得
        if (!tweetId) {
            const articleId = tweetElement.getAttribute('aria-labelledby');
            if (articleId) {
                const idMatch = articleId.match(/(\d+)$/);
                if (idMatch) {
                    tweetId = idMatch[1];
                    tweetUrl = `https://twitter.com/i/status/${tweetId}`;
                }
            }
        }

        // 投稿者名を取得
        const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
        const author = authorElement ? authorElement.textContent : '';

        console.log('抽出したツイートデータ:', {
            id: tweetId,
            text: tweetText,
            url: tweetUrl,
            author: author
        });

        return {
            id: tweetId,
            text: tweetText,
            url: tweetUrl,
            author: author
        };
    } catch (error) {
        console.error('ツイートデータの抽出に失敗:', error);
        return null;
    }
}

// シート選択モーダルの表示
function showSheetSelectionModal(tweetData) {
    // 既存のモーダルがあれば削除
    const existingModal = document.querySelector('.xsheet-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // モーダルを作成
    const modal = document.createElement('div');
    modal.className = 'xsheet-modal';
    modal.innerHTML = `
        <div class="xsheet-modal-content">
            <div class="xsheet-modal-header">
                <h2>シートを選択</h2>
                <button class="xsheet-close-button">&times;</button>
            </div>
            <div class="xsheet-modal-body">
                <div class="xsheet-sheet-list">
                    <div class="xsheet-loading">シート一覧を読み込み中...</div>
                </div>
                <div class="xsheet-new-sheet">
                    <button class="xsheet-new-sheet-button">
                        + 新しいシート
                    </button>
                </div>
            </div>
        </div>
    `;

    // モーダルを表示
    document.body.appendChild(modal);

    // 閉じるボタンの処理
    const closeButton = modal.querySelector('.xsheet-close-button');
    closeButton.addEventListener('click', () => modal.remove());

    // モーダルの外側をクリックして閉じる
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // シート一覧を読み込む
    loadSheetList(modal, tweetData);
}

// シート一覧の読み込み
async function loadSheetList(modal, tweetData) {
    const sheetList = modal.querySelector('.xsheet-sheet-list');
    
    try {
        console.log('シート一覧を取得中...');
        
        // APIトークンを取得または確認
        const apiToken = await getApiToken();
        if (!apiToken) {
            console.log('APIトークンが取得できませんでした');
            throw new Error('認証が必要です');
        }
        
        const response = await fetch('https://x-sheet.com/api/sheets', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-API-Token': apiToken,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        console.log('APIレスポンス:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
            const responseText = await response.text();
            console.log('エラーレスポンス本文:', responseText);

            if (response.status === 401) {
                // 認証が必要な場合の処理
                let loginUrl = 'https://x-sheet.com/login';
                
                try {
                    const errorData = JSON.parse(responseText);
                    if (errorData.loginUrl) {
                        loginUrl = errorData.loginUrl;
                    }
                } catch (e) {
                    // JSONパースエラーの場合はデフォルトURLを使用
                    console.log('レスポンスJSONパースエラー、デフォルトログインURLを使用');
                }
                
                // ログインページをポップアップで開く
                const loginWindow = window.open(loginUrl, 'login', 
                    'width=600,height=400,menubar=no,toolbar=no,location=no,status=no');
                
                // ログインウィンドウが閉じられたら再試行   
                const checkLoginInterval = setInterval(() => {
                    if (loginWindow.closed) {
                        clearInterval(checkLoginInterval);
                        // APIキー設定モーダルを表示
                        showApiKeyModal();
                    }
                }, 1000);
                
                return;
            }
            throw new Error(`シート一覧の取得に失敗しました: ${response.status} ${response.statusText}\n${responseText}`);
        }

        // レスポンスの内容をログに出力
        const responseData = await response.clone().text();
        console.log('APIレスポンス本文:', responseData);

        const data = await response.json();
        
        if (data.success && data.sheets) {
            // シート一覧を表示
            sheetList.innerHTML = data.sheets.map(sheet => `
                <div class="xsheet-sheet-item" data-sheet-id="${sheet.id}">
                    <div class="xsheet-sheet-info">
                        <div class="xsheet-sheet-title">${sheet.title}</div>
                        <div class="xsheet-sheet-date">${new Date(sheet.createdAt).toLocaleString('ja-JP')}</div>
                    </div>
                    <button class="xsheet-select-button">選択</button>
                </div>
            `).join('');

            // シート選択ボタンのイベントを設定
            const selectButtons = modal.querySelectorAll('.xsheet-select-button');
            selectButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const sheetItem = button.closest('.xsheet-sheet-item');
                    const sheetId = sheetItem.dataset.sheetId;
                    const sheetTitle = sheetItem.querySelector('.xsheet-sheet-title').textContent;
                    saveToSheet(tweetData, sheetId, sheetTitle, modal);
                });
            });
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Failed to load sheets:', error);
        sheetList.innerHTML = `
            <div class="xsheet-error">
                シート一覧の読み込みに失敗しました。
                <button class="xsheet-retry-button">再試行</button>
            </div>
        `;

        // 再試行ボタンの処理
        const retryButton = sheetList.querySelector('.xsheet-retry-button');
        retryButton.addEventListener('click', () => {
            loadSheetList(modal, tweetData);
        });
    }
}

// シートに保存
async function saveToSheet(tweetData, sheetId, sheetTitle, modal) {
    try {
        console.log('シートに保存を開始:', {
            url: tweetData.url,
            sheetId: sheetId,
            sheetTitle: sheetTitle
        });

        if (!tweetData.url) {
            throw new Error('ツイートのURLが取得できませんでした');
        }

        // APIトークンを取得
        const apiToken = await getApiToken();
        if (!apiToken) {
            throw new Error('APIトークンが取得できませんでした');
        }

        const response = await fetch('https://x-sheet.com/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-API-Token': apiToken,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                url: tweetData.url,
                content: tweetData.text || '',
                sheetId: sheetId
            })
        });

        console.log('APIレスポンス:', {
            status: response.status,
            statusText: response.statusText
        });

        const responseText = await response.text();
        console.log('レスポンス本文:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('JSONパースエラー:', e);
            throw new Error('サーバーからの応答が不正です');
        }
        
        if (response.ok) {
            showNotification(`シート「${sheetTitle}」に追加しました`, 'success');
            modal.remove();
        } else if (response.status === 401) {
            // 認証エラーの場合
            let loginUrl = 'https://x-sheet.com/login';
            const loginUrlHeader = response.headers.get('X-Login-URL');
            if (loginUrlHeader) {
                loginUrl = loginUrlHeader;
            }
            
            // ログインページを開く
            const loginWindow = window.open(loginUrl, 'login', 
                'width=600,height=400,menubar=no,toolbar=no,location=no,status=no');
            
            const checkLoginInterval = setInterval(() => {
                if (loginWindow.closed) {
                    clearInterval(checkLoginInterval);
                    showNotification('APIキーを設定してください', 'info');
                    showApiKeyModal();
                }
            }, 1000);
        } else {
            throw new Error(data.error || '保存に失敗しました');
        }
    } catch (error) {
        console.error('シートへの保存に失敗:', error);
        showNotification(error.message, 'error');
    }
}

// 通知の表示
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `xsheet-notification xsheet-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // 3秒後に通知を消す
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// APIキーを取得または設定モーダルを表示
async function getApiToken() {
    return new Promise((resolve) => {
        // Chrome拡張機能のストレージからAPIキーを取得
        chrome.storage.sync.get(['xsheet-api-key'], (result) => {
            const apiKey = result['xsheet-api-key'];
            
            if (apiKey && apiKey.trim()) {
                console.log('保存されたAPIキーを使用:', apiKey.substring(0, 10) + '...');
                resolve(apiKey.trim());
            } else {
                console.log('APIキーが設定されていません');
                // APIキー設定モーダルを表示
                showApiKeyModal();
                resolve(null);
            }
        });
    });
}

// APIキー設定モーダルを表示
function showApiKeyModal() {
    const apiKeyModal = document.createElement('div');
    apiKeyModal.className = 'xsheet-modal';
    apiKeyModal.innerHTML = `
        <div class="xsheet-modal-content">
            <div class="xsheet-modal-header">
                <h2>X-Sheet APIキーの設定</h2>
                <button class="xsheet-close-button">&times;</button>
            </div>
            <div class="xsheet-modal-body">
                <p>X-Sheetの機能を使用するには、APIキーが必要です。</p>
                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">APIキー:</label>
                    <input type="text" id="xsheet-api-key-input" placeholder="APIキーを入力してください" 
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 15px;">
                        APIキーは <a href="https://x-sheet.com/settings/api" target="_blank" style="color: #1d9bf0;">X-Sheet設定ページ</a> で取得できます
                    </div>
                </div>
                <div style="text-align: center;">
                    <button class="xsheet-save-api-key-button" style="background: #1d9bf0; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                        保存
                    </button>
                    <button class="xsheet-open-settings-button" style="background: #657786; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        設定ページを開く
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(apiKeyModal);

    // 既存のAPIキーがあれば表示
    chrome.storage.sync.get(['xsheet-api-key'], (result) => {
        if (result['xsheet-api-key']) {
            document.getElementById('xsheet-api-key-input').value = result['xsheet-api-key'];
        }
    });

    // 閉じるボタンの処理
    const closeButton = apiKeyModal.querySelector('.xsheet-close-button');
    closeButton.addEventListener('click', () => apiKeyModal.remove());

    // 保存ボタンの処理
    const saveButton = apiKeyModal.querySelector('.xsheet-save-api-key-button');
    saveButton.addEventListener('click', () => {
        const apiKey = document.getElementById('xsheet-api-key-input').value.trim();
        if (apiKey) {
            // Chrome拡張機能のストレージに保存
            chrome.storage.sync.set({'xsheet-api-key': apiKey}, () => {
                showNotification('APIキーを保存しました', 'success');
                apiKeyModal.remove();
            });
        } else {
            showNotification('APIキーを入力してください', 'error');
        }
    });

    // 設定ページを開くボタンの処理
    const settingsButton = apiKeyModal.querySelector('.xsheet-open-settings-button');
    settingsButton.addEventListener('click', () => {
        window.open('https://x-sheet.com/settings/api', '_blank');
    });

    // モーダルの外側をクリックして閉じる
    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) {
            apiKeyModal.remove();
        }
    });
}

// 拡張機能の初期化
function initializeExtension() {
    setupLikeButtonObserver();
}

// 拡張機能の初期化を実行
initializeExtension();
