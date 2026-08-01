/**
 * config.js — 環境依存の値はここだけ。
 * ここに秘密は書かない（このリポジトリは GitHub Pages 公開用）。
 * 合言葉はブラウザで sha256 にしてから送られ、端末の localStorage にしか残らない。
 */
window.INC_CONFIG = {
  // GAS Web App（API用デプロイ）の /exec URL。デプロイし直したらこの1行だけ差し替える。
  endpoint: 'REPLACE_WITH_API_EXEC_URL',
  views: ['dash', 'input', 'consign', 'fixed', 'expense'],
  timeoutMs: 45000
};
