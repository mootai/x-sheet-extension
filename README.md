# x-sheet-extension

X-Sheet: Xのいいねを整理するChrome拡張機能
X (旧Twitter) のいいねをカテゴリー別に整理・公開できるWebアプリ「X-Sheet」のための、Chrome拡張機能リポジトリです。

この拡張機能を利用することで、Xのタイムラインを閲覧中に、簡単にいいねをカテゴリー分けできます。

※ このプロジェクトは現在、開発中です。

 拡張機能の始め方
# 1. Webアプリでの準備
[X-Sheet](https://x-sheet.com/login) にアクセスし、アカウントを作成・ログインします。
<img width="1886" height="943" alt="Image" src="https://github.com/user-attachments/assets/a7e13488-b19e-4da4-9683-7d6dfad1693b" />

「シート」を作成し、いいねを分類するためのカテゴリーを準備します。
<img width="1918" height="945" alt="Image" src="https://github.com/user-attachments/assets/5c66e878-610c-495b-9610-c70909b0c899" />

ログイン後、ページ上部にある「拡張機能」リンクに移動してして、APIキーを発行して取得します。
<img width="1919" height="937" alt="Image" src="https://github.com/user-attachments/assets/313e7d1a-1369-42c0-a5f0-431b2fdcc033" />

# 2. 拡張機能のセットアップ
このリポジトリをダウンロードします。

Chromeブラウザを開き、「拡張機能の管理」ページに移動します。

デベロッパーモードを有効にします。

「パッケージ化されていない拡張機能を読み込む」をクリックし、ダウンロードしたリポジトリのフォルダを選択します。

# 3. 使い方
X-Sheetにログインした状態で、Xのタイムラインに戻ります。

ページ更新後 APIキーを再入力から、Webアプリで発行したAPIキーを入力して連携します。
<img width="1113" height="901" alt="Image" src="https://github.com/user-attachments/assets/655cf2f9-2e6b-4291-abe8-07651a7863fe" />

設定が完了して再度ページを更新すると、先ほど追加したシートボタンがついかされカテゴライズすることがかのうになります。
![Image](https://github.com/user-attachments/assets/e3be976e-62bd-4b33-9c59-9b0825964977)

![Image](https://github.com/user-attachments/assets/33b1b96a-844e-4f43-ac96-7134d67ed61e)

シートに追加した内容は，X-Sheetで確認することができます。
