/**
 * config.js — 環境依存の値はここだけ。
 * ここに秘密は書かない（このリポジトリは GitHub Pages 公開用）。
 * 合言葉はブラウザで sha256 にしてから送られ、端末の localStorage にしか残らない。
 */
window.INC_CONFIG = {
  // GAS Web App（API用デプロイ）の /exec URL。デプロイし直したらこの1行だけ差し替える。
  endpoint: 'https://script.google.com/macros/s/AKfycby1DbhheE5F-Zdpabq3-NSW0uTtPd7wSi51YjWhm5yrgDdjulp2LIIZj4VnD23b7gi-/exec',
  views: ['dash', 'input', 'consign', 'fixed', 'expense'],
  timeoutMs: 45000
};
