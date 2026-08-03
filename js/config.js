/**
 * config.js — 環境依存の値と色。ここだけ見れば差し替えられるようにする。
 * ここに秘密は書かない（このリポジトリは GitHub Pages 公開用）。
 * 合言葉はブラウザで sha256 にしてから送られ、端末の localStorage にしか残らない。
 */
window.INC_CONFIG = {
  // GAS Web App（API用デプロイ）の /exec URL。デプロイし直したらこの1行だけ差し替える。
  endpoint: 'https://script.google.com/macros/s/AKfycbyjzy5yeEBnW60nMKzOpUsLGR3WKdsuhFFCjeYhVpsNc2VF_uaAOhy3eBpZKC9HlBQw/exec',

  // 実在する画面。?tab= はこの中の値だけを受け付ける。
  views: ['dash', 'consign', 'fixed', 'expense'],
  // 旧レイアウトの ?tab=input 。画面ではなく「追加シート」を開く合図として残す。
  addTab: 'input',

  timeoutMs: 45000,

  /**
   * インキとシリーズの色。ここが唯一の出所で、theme.js が :root へ流し込み、
   * チャート（views.js）も同じ値を読む。CSS にも JS にも生 hex を散らさない。
   * 「地」の色（paper / shade / topbar / dot）だけは初回描画に間に合わせるため
   * css/skin.css が持つ（JS を待つと真っ白の一瞬が出るため）。
   */
  palette: {
    ink: '#191519', ink2: '#5B5248', ink3: '#6E6459',
    wine: '#7A2233', lime: '#D4FF00',
    s1: '#3F5D75', s2: '#D4622A', s3: '#6E8047', s4: '#B9647A',
    neg: '#7A2233',
    s3l: '#9DB57C'   // 「販売中」タグ用の明るいペッパーグリーン（AA確保）
  }
};
