/**
 * theme.js — js/config.js の PALETTE を CSS 変数へ流し込むだけの層。
 *
 * 見た目は夜（オフブラックの地）1本で固定（2026-08-03 オーナー指示で昼夜の切替を廃止）。
 * 地の色は css/skin.css の :root が持ち、インキとシリーズ色だけをここで流し込む。
 * 他のファイルから呼ぶものは無いので、読み込まれた時点で終わり。
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var p = window.INC_CONFIG.palette;
  for (var k in p) {
    if (Object.prototype.hasOwnProperty.call(p, k)) root.style.setProperty('--' + k, p[k]);
  }

  // 切替を廃止する前に「紙」を選んだ端末に選択が残っている。
  // 読む側はもう居ないので効きはしないが、意味の無い値を残さない。
  try { localStorage.removeItem('inc_theme'); } catch (e) { /* プライベートモードでは元々残っていない */ }
})();
