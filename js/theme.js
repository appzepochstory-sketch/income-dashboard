/**
 * theme.js — 色の適用とテーマ切替だけを持つ。
 *
 * テーマは html[data-theme] の "night"（夜・オフブラック地／既定）と "paper"（生成り紙）の2種。
 * 入れ替わるのは「地」の色だけで、数字が載るプレートは両テーマとも紙色のまま＝可読性は不変。
 */
window.IncTheme = (function () {
  'use strict';

  var KEY = 'inc_theme';
  var DEFAULT = 'night';
  var root = document.documentElement;

  /** PALETTE を CSS変数に流し込む。以降 CSS も JS も var(--xx) 経由で色を引く。 */
  function applyPalette() {
    var p = window.INC_CONFIG.palette;
    for (var k in p) {
      if (Object.prototype.hasOwnProperty.call(p, k)) root.style.setProperty('--' + k, p[k]);
    }
  }

  function current() { return root.dataset.theme === 'paper' ? 'paper' : 'night'; }

  function set(name) {
    root.dataset.theme = (name === 'paper') ? 'paper' : 'night';
    try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) { /* プライベートモードでは残さないだけ */ }
  }

  function toggle() {
    set(current() === 'night' ? 'paper' : 'night');
    return current();
  }

  /** 起動時。保存された選択があればそれ、無ければ夜。 */
  function init() {
    applyPalette();
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
    set(saved || DEFAULT);
  }

  init();
  return { current: current, set: set, toggle: toggle };
})();
