// バックグラウンドスクリプト
// 現時点では特別な処理は必要ありませんが、
// 将来的にはここでセッション管理やAPIリクエストの中継などを行う可能性があります。

chrome.runtime.onInstalled.addListener(() => {
    console.log('Xsheet Integration extension installed');
});
