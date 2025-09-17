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

        // API承認後にシート分類UIを追加
        addSheetClassificationUI(button);
    });
}

// いいねボタンクリック時の処理
async function handleLikeButtonClick(event) {
    // いいねされた要素から投稿データを取得
    const tweetElement = event.target.closest('article');
    if (!tweetElement) return;

    // いいね解除された場合はスキップ
    const unlike = tweetElement.querySelector('[data-testid="unlike"]');
    if (unlike) return;

    const xsheetSaved = tweetElement.querySelector('[data-xsheet-saved="true"]');
    if (xsheetSaved) {
        console.log('シート分類ボタンが既に押されているため、モーダルを表示しません');
        return;
    }

    // シート分類ボタンが押された後の場合はスキップ（二重分類を防ぐ）
    const classificationUI = tweetElement.querySelector('.xsheet-classification-ui');
    if (classificationUI) {
        const savedButtons = classificationUI.querySelectorAll('[data-xsheet-saved="true"]');
        console.log('分類UI内の保存済みボタン数:', savedButtons.length);
        if (savedButtons.length > 0) {
            console.log('シート分類ボタンが既に押されているため、モーダルを表示しません');
            return;
        }
    }

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

    // アカウント情報を取得
    const accountInfo = getAccountInfo();
    const accountDisplay = accountInfo.isLoggedIn 
        ? `<div class="xsheet-account-info">
             <span class="xsheet-account-name">${accountInfo.accountName}</span>
             <span class="xsheet-account-id">ID: ${accountInfo.accountId}</span>
           </div>`
        : '<div class="xsheet-account-info xsheet-not-logged-in">ログインしていません</div>';

    // モーダルを作成
    const modal = document.createElement('div');
    modal.className = 'xsheet-modal';
    modal.innerHTML = `
        <div class="xsheet-modal-content">
            <div class="xsheet-modal-header">
                <h2>シートを選択</h2>
                ${accountDisplay}
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

        // ログイン状態を確認
        const isLoggedIn = await checkLoginStatus();
        if (!isLoggedIn) {
            console.log('ログインしていません');
            throw new Error('認証が必要です');
        }

        // APIトークンを取得または確認
        const apiToken = await getApiToken();
        if (!apiToken) {
            console.log('APIトークンが取得できませんでした');
            throw new Error('認証が必要です');
        }

        const response = await fetch(`${XSHEET_BASE_URL}/api/sheets`, {
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
                // APIキー認証エラーの場合
                console.log('APIキー認証エラー');
                showApiKeyErrorModal('APIキーが無効または期限切れです。シート一覧を取得できません。');
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

        const response = await fetch(`${XSHEET_BASE_URL}/api/posts`, {
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
            // APIキー認証エラーの場合
            console.log('APIキー認証エラー');
            showApiKeyErrorModal('APIキーが無効または期限切れです。ツイートを保存できません。');
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

// APIキー承認エラー時のモーダルを表示
function showApiKeyErrorModal(errorMessage = 'APIキーの認証に失敗しました') {
    const errorModal = document.createElement('div');
    errorModal.className = 'xsheet-modal';
    errorModal.innerHTML = `
        <div class="xsheet-modal-content">
            <div class="xsheet-modal-header">
                <h2>APIキー認証エラー</h2>
                <button class="xsheet-close-button">&times;</button>
            </div>
            <div class="xsheet-modal-body">
                <div class="xsheet-error-icon">⚠️</div>
                <p class="xsheet-error-message">${errorMessage}</p>
                <p>APIキーを再入力するか、新しいAPIキーを発行してください。</p>
                <div style="text-align: center; margin-top: 30px;">
                    <button class="xsheet-retry-api-key-button" style="background: #1d9bf0; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; margin-right: 10px; font-size: 14px;">
                        APIキーを再入力
                    </button>
                    <button class="xsheet-regenerate-api-key-button" style="background: #17bf63; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; margin-right: 10px; font-size: 14px;">
                        新しいAPIキーを発行
                    </button>
                    <button class="xsheet-open-settings-button" style="background: #657786; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        設定ページを開く
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(errorModal);

    // 閉じるボタンの処理
    const closeButton = errorModal.querySelector('.xsheet-close-button');
    closeButton.addEventListener('click', () => errorModal.remove());

    // APIキー再入力ボタンの処理
    const retryButton = errorModal.querySelector('.xsheet-retry-api-key-button');
    retryButton.addEventListener('click', () => {
        errorModal.remove();
        showApiKeyModal();
    });

    // 新しいAPIキー発行ボタンの処理
    const regenerateButton = errorModal.querySelector('.xsheet-regenerate-api-key-button');
    regenerateButton.addEventListener('click', () => {
        errorModal.remove();
        showApiKeyRegenerateModal();
    });

    // 設定ページを開くボタンの処理
    const settingsButton = errorModal.querySelector('.xsheet-open-settings-button');
    settingsButton.addEventListener('click', () => {
        window.open(`${XSHEET_BASE_URL}/settings/api`, '_blank');
    });

    // モーダルの外側をクリックして閉じる
    errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) {
            errorModal.remove();
        }
    });
}

// APIキー再発行モーダルを表示
function showApiKeyRegenerateModal() {
    const regenerateModal = document.createElement('div');
    regenerateModal.className = 'xsheet-modal';
    regenerateModal.innerHTML = `
        <div class="xsheet-modal-content">
            <div class="xsheet-modal-header">
                <h2>新しいAPIキーを発行</h2>
                <button class="xsheet-close-button">&times;</button>
            </div>
            <div class="xsheet-modal-body">
                <p>新しいAPIキーを発行します。既存のAPIキーは無効になります。</p>
                <div style="background: #f7f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1d9bf0;">
                    <strong>注意:</strong> 既存のAPIキーを使用している他のアプリケーションや拡張機能がある場合、それらも新しいAPIキーに更新する必要があります。
                </div>
                <div style="text-align: center; margin-top: 30px;">
                    <button class="xsheet-confirm-regenerate-button" style="background: #e0245e; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; margin-right: 10px; font-size: 14px;">
                        新しいAPIキーを発行
                    </button>
                    <button class="xsheet-cancel-regenerate-button" style="background: #657786; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(regenerateModal);

    // 閉じるボタンの処理
    const closeButton = regenerateModal.querySelector('.xsheet-close-button');
    closeButton.addEventListener('click', () => regenerateModal.remove());

    // 新しいAPIキー発行確認ボタンの処理
    const confirmButton = regenerateModal.querySelector('.xsheet-confirm-regenerate-button');
    confirmButton.addEventListener('click', async () => {
        try {
            // ログインページを開いて新しいAPIキーを発行してもらう
            const loginWindow = window.open(`${XSHEET_BASE_URL}/settings/api`, '_blank');
            
            regenerateModal.remove();
            showNotification('設定ページで新しいAPIキーを発行してください', 'info');
            
            // 設定ページが閉じられたら再確認
            const checkClosedInterval = setInterval(() => {
                if (loginWindow.closed) {
                    clearInterval(checkClosedInterval);
                    showApiKeyModal();
                }
            }, 1000);
            
        } catch (error) {
            console.error('APIキー再発行エラー:', error);
            showNotification('エラーが発生しました', 'error');
        }
    });

    // キャンセルボタンの処理
    const cancelButton = regenerateModal.querySelector('.xsheet-cancel-regenerate-button');
    cancelButton.addEventListener('click', () => {
        regenerateModal.remove();
        showApiKeyModal();
    });

    // モーダルの外側をクリックして閉じる
    regenerateModal.addEventListener('click', (e) => {
        if (e.target === regenerateModal) {
            regenerateModal.remove();
        }
    });
}

// APIキー設定モーダルを表示
function showApiKeyModal() {
    // アカウント情報を取得
    const accountInfo = getAccountInfo();
    const accountDisplay = accountInfo.isLoggedIn 
        ? `<div class="xsheet-account-info">
             <span class="xsheet-account-name">${accountInfo.accountName}</span>
             <span class="xsheet-account-id">ID: ${accountInfo.accountId}</span>
           </div>`
        : '<div class="xsheet-account-info xsheet-not-logged-in">ログインしていません</div>';

    const apiKeyModal = document.createElement('div');
    apiKeyModal.className = 'xsheet-modal';
    apiKeyModal.innerHTML = `
        <div class="xsheet-modal-content">
            <div class="xsheet-modal-header">
                <h2>X-Sheet APIキーの設定</h2>
                ${accountDisplay}
                <button class="xsheet-close-button">&times;</button>
            </div>
            <div class="xsheet-modal-body">
                <p>X-Sheetの機能を使用するには、APIキーが必要です。</p>
                <div style="margin: 20px 0;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">APIキー:</label>
                    <input type="text" id="xsheet-api-key-input" placeholder="APIキーを入力してください" 
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 15px;">
                        APIキーは <a href="${XSHEET_BASE_URL}/settings/api" target="_blank" style="color: #1d9bf0;">X-Sheet設定ページ</a> で取得できます
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
    saveButton.addEventListener('click', async () => {
        const apiKey = document.getElementById('xsheet-api-key-input').value.trim();
        if (apiKey) {
            // Chrome拡張機能のストレージに保存
            chrome.storage.sync.set({ 'xsheet-api-key': apiKey }, async () => {
                showNotification('APIキーを保存しました', 'success');
                
                // ログイン状態を再確認
                await checkLoginStatus();
                
                apiKeyModal.remove();
            });
        } else {
            showNotification('APIキーを入力してください', 'error');
        }
    });

    // 設定ページを開くボタンの処理
    const settingsButton = apiKeyModal.querySelector('.xsheet-open-settings-button');
    settingsButton.addEventListener('click', () => {
        window.open(`${XSHEET_BASE_URL}/settings/api`, '_blank');
    });

    // モーダルの外側をクリックして閉じる
    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) {
            apiKeyModal.remove();
        }
    });
}

// ベースURL設定（開発環境と本番環境の切り替え）
// const XSHEET_BASE_URL = 'https://x-sheet.com'; // 本番環境
const XSHEET_BASE_URL = 'http://localhost:8443'; // 開発環境

// アカウント情報を保持する変数
let accountInfo = {
    isLoggedIn: false,
    accountName: '',
    accountId: '',
    lastChecked: 0
};

// APIキーを用いたログイン確認処理
async function checkLoginStatus() {
    try {
        const apiToken = await getApiToken();
        if (!apiToken) {
            accountInfo.isLoggedIn = false;
            accountInfo.accountName = '';
            accountInfo.accountId = '';
            return false;
        }

        // 最後にチェックした時刻から5分以内の場合はキャッシュを使用
        const now = Date.now();
        if (accountInfo.isLoggedIn && (now - accountInfo.lastChecked) < 5 * 60 * 1000) {
            return true;
        }

        console.log('ログイン状態を確認中...');

        const response = await fetch(`${XSHEET_BASE_URL}/api/auth/user/profile`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-API-Token': apiToken,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                accountInfo.isLoggedIn = true;
                accountInfo.accountName = data.user.name || data.user.username || '';
                accountInfo.accountId = data.user.id || '';
                accountInfo.lastChecked = now;
                console.log('ログイン確認成功:', {
                    name: accountInfo.accountName,
                    id: accountInfo.accountId
                });
                return true;
            }
        } else if (response.status === 401) {
            // APIキー認証エラーの場合
            accountInfo.isLoggedIn = false;
            accountInfo.accountName = '';
            accountInfo.accountId = '';
            accountInfo.lastChecked = now;
            console.log('APIキー認証エラー');
            
            // エラーモーダルを表示
            showApiKeyErrorModal('APIキーが無効または期限切れです');
            return false;
        }

        // ログイン失敗の場合
        accountInfo.isLoggedIn = false;
        accountInfo.accountName = '';
        accountInfo.accountId = '';
        accountInfo.lastChecked = now;
        console.log('ログイン確認失敗');
        return false;

    } catch (error) {
        console.error('ログイン状態確認エラー:', error);
        accountInfo.isLoggedIn = false;
        accountInfo.accountName = '';
        accountInfo.accountId = '';
        return false;
    }
}

// アカウント情報を取得（キャッシュ優先）
function getAccountInfo() {
    return {
        isLoggedIn: accountInfo.isLoggedIn,
        accountName: accountInfo.accountName,
        accountId: accountInfo.accountId
    };
}

// シート分類UIを追加
async function addSheetClassificationUI(likeButton) {
    try {
        // API承認状態を確認
        const isLoggedIn = await checkLoginStatus();
        if (!isLoggedIn) {
            console.log('API承認されていないため、シート分類UIを追加しません');
            return;
        }

        // 4つ上の階層のdivタグを取得
        const targetDiv = getTargetDiv(likeButton);
        if (!targetDiv) {
            console.log('対象のdivタグが見つかりません');
            return;
        }

        // 既にシート分類UIが追加されているかチェック
        if (targetDiv.querySelector('.xsheet-classification-ui')) {
            return;
        }

        // シート一覧を取得
        const sheets = await getSheets();
        if (!sheets || sheets.length === 0) {
            console.log('シートが見つかりません');
            return;
        }

        // 新しいdivタグを作成
        const classificationDiv = createClassificationDiv(sheets, likeButton);
        
        // 対象のdivタグに追加
        targetDiv.appendChild(classificationDiv);

        console.log('シート分類UIを追加しました');

    } catch (error) {
        console.error('シート分類UIの追加に失敗:', error);
    }
}

// 4つ上の階層のdivタグを取得
function getTargetDiv(likeButton) {
    let currentElement = likeButton;
    let level = 0;
    
    while (currentElement && level < 4) {
        currentElement = currentElement.parentElement;
        level++;
    }
    
    // divタグを探す
    while (currentElement && currentElement.tagName !== 'DIV') {
        currentElement = currentElement.parentElement;
    }
    
    return currentElement;
}

// シート一覧を取得
async function getSheets() {
    try {
        const apiToken = await getApiToken();
        if (!apiToken) {
            return null;
        }

        const response = await fetch(`${XSHEET_BASE_URL}/api/sheets`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-API-Token': apiToken,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.sheets) {
                return data.sheets;
            }
        }
        
        return null;
    } catch (error) {
        console.error('シート一覧の取得に失敗:', error);
        return null;
    }
}

// 分類用のdivタグを作成
function createClassificationDiv(sheets, likeButton) {
    const classificationDiv = document.createElement('div');
    classificationDiv.className = 'css-175oi2r r-1kbdv8c r-18u37iz r-1wtj0ep r-1ye8kvj r-1s2bzr4 xsheet-classification-ui';
    classificationDiv.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
        padding: 8px;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
        opacity: 1;
        transition: opacity 0.3s ease;
        color: rgb(113, 118, 123);
    `;

    // シート名ボタンを作成
    sheets.forEach(sheet => {
        const sheetButton = createSheetButton(sheet, likeButton);
        classificationDiv.appendChild(sheetButton);
    });

    // ホバー時に表示
    const parentDiv = getTargetDiv(likeButton);
    // if (parentDiv) {
    //     parentDiv.addEventListener('mouseenter', () => {
    //         classificationDiv.style.opacity = '1';
    //     });
        
    //     parentDiv.addEventListener('mouseleave', () => {
    //         classificationDiv.style.opacity = '0';
    //     });
    // }

    return classificationDiv;
}

// シート名ボタンを作成
function createSheetButton(sheet, likeButton) {
    const button = document.createElement('button');
    button.className = 'xsheet-sheet-button';
    
    // SVGアイコンを作成（フォルダアイコン）
    const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgIcon.setAttribute('width', '16');
    svgIcon.setAttribute('height', '16');
    svgIcon.setAttribute('viewBox', '0 0 512 512');
    svgIcon.setAttribute('fill', 'currentColor');
    svgIcon.style.cssText = 'margin-right: 4px; vertical-align: middle;';
    
    // フォルダのパス要素を作成
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M492.459,128.673c-12-12.033-28.836-19.558-47.18-19.542H249.91c-4.598-0.016-8.533-1.795-11.565-4.795c-3-3.041-4.779-6.967-4.795-11.566v-3.278c0.016-18.345-7.508-35.188-19.541-47.18c-11.992-12.033-28.836-19.558-47.18-19.541H66.721c-18.344-0.017-35.189,7.508-47.18,19.541C7.508,54.303-0.017,71.147,0,89.492v44.819v44.484v243.722c-0.017,18.344,7.508,35.188,19.541,47.172c12,12.033,28.836,19.557,47.18,19.541h378.558c18.344,0.016,35.18-7.508,47.18-19.541c12.033-11.984,19.558-28.828,19.541-47.172V175.853C512.017,157.508,504.492,140.664,492.459,128.673z M461.639,422.517c-0.017,4.598-1.787,8.524-4.787,11.566c-3.041,2.991-6.976,4.77-11.574,4.787H66.721c-4.598-0.017-8.533-1.796-11.574-4.787c-3-3.041-4.77-6.968-4.786-11.566V178.795v-44.484V89.492c0.017-4.599,1.795-8.524,4.795-11.574c3.041-3,6.968-4.771,11.566-4.787h100.107c4.598,0.016,8.524,1.787,11.565,4.787c3,3.049,4.778,6.975,4.795,11.574v3.278c-0.017,18.345,7.508,35.18,19.541,47.18c11.992,12.033,28.836,19.558,47.18,19.541h195.369c4.598,0.017,8.524,1.787,11.565,4.788c3,3.049,4.778,6.975,4.795,11.574V422.517z');
    
    svgIcon.appendChild(path);
    
    // ボタンの内容を設定
    button.appendChild(svgIcon);
    button.appendChild(document.createTextNode(sheet.title));
    
    button.style.cssText = `
        background: none;
        color: #71767B;
        border: none;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s ease;
        display: flex;
        align-items: center;
    `;

    button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(249, 24, 128, 0.1)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.background = 'none';
    });

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        try {
            // ツイートデータを取得
            const tweetElement = likeButton.closest('article');
            if (!tweetElement) return;

            const tweetData = extractTweetData(tweetElement);
            if (!tweetData) return;

            // シートに保存
            await saveToSheetDirect(tweetData, sheet.id, sheet.title);
            
            // 元のいいねボタンも押す（JSは作動させない）
            const originalLikeButton = tweetElement.querySelector('[data-testid="like"]');
            originalLikeButton.dataset.xsheetSaved = 'true';
            if (originalLikeButton) {
                // 一時的にイベントリスナーを無効化
                // const tempHandler = originalLikeButton.onclick;
                // originalLikeButton.onclick = null;
                
                // クリックイベントを発火
                originalLikeButton.click();
                
                // イベントリスナーを復元
                // setTimeout(() => {
                //     originalLikeButton.onclick = tempHandler;
                // }, 100);
            }
            
            // ボタンの状態を永続的に変更（いいね後）
            button.style.background = 'none';
            button.style.color = 'rgb(249, 24, 128)';
            
            // ボタンのテキストのみを「保存済み」に変更（フォルダアイコンは維持）
            // const textNode = button.lastChild;
            // if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            //     textNode.textContent = '保存済み';
            // }
            
            button.dataset.xsheetSaved = 'true';
            
            // デバッグ用：属性が正しく設定されているか確認
            console.log('data-xsheet-saved属性を設定:', button.dataset.xsheetSaved);

        } catch (error) {
            console.error('シートへの保存に失敗:', error);
            showNotification('保存に失敗しました', 'error');
        }
    });

    return button;
}

// 直接シートに保存
async function saveToSheetDirect(tweetData, sheetId, sheetTitle) {
    try {
        const apiToken = await getApiToken();
        if (!apiToken) {
            throw new Error('APIトークンが取得できませんでした');
        }

        const response = await fetch(`${XSHEET_BASE_URL}/api/posts`, {
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

        if (response.ok) {
            showNotification(`シート「${sheetTitle}」に追加しました`, 'success');
        } else if (response.status === 401) {
            showApiKeyErrorModal('APIキーが無効または期限切れです。');
        } else {
            const data = await response.json();
            throw new Error(data.error || '保存に失敗しました');
        }
    } catch (error) {
        console.error('シートへの保存に失敗:', error);
        throw error;
    }
}

// 拡張機能の初期化
function initializeExtension() {
    setupLikeButtonObserver();
    
    // 初期ログイン確認を実行
    checkLoginStatus();
    
    // 定期的にログイン状態を確認（10分間隔）
    // setInterval(checkLoginStatus, 10 * 60 * 1000);
}

// 拡張機能の初期化を実行
initializeExtension();
