# income-dashboard (front-end)

個人の収入ダッシュボードの画面だけを置いたリポジトリ。GitHub Pages で配信する。

- **データはこのリポジトリに一切入っていない。** 表示するたびに Google Apps Script の JSON API から取得する
- API は合言葉（パスフレーズ）認証。合言葉はこのリポジトリにも含まれず、ブラウザで SHA-256 にしてから送られる
- 外部CDN・外部フォント・外部画像は使わない（単体で完結）

```
index.html      画面の骨格（5タブ）
css/app.css     暫定スキン
js/config.js    APIのURLなど環境依存の値
js/api.js       通信と認証（DOMを触らない）
js/views.js     描画（差し替え対象）
js/app.js       配線
```

デザインを差し替えるときに触るのは `css/app.css` と `js/views.js`。
`js/api.js` の返すデータ構造は変わらないので、`js/app.js` の呼び出し先を合わせれば動く。
