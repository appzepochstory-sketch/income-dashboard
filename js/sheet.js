/**
 * sheet.js — 下から出てくるパネルの開け閉めだけを持つ「入れ物」。
 * 中身が何か（選択カードなのかフォームなのか）は知らない。呼ぶ側が組んで渡す。
 */
window.IncSheet = (function () {
  'use strict';

  var sheet = document.getElementById('sheet');
  var bg = document.getElementById('sheetbg');
  var body = document.getElementById('sheetBody');
  var grip = document.getElementById('sheetGrip');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function head(title) {
    var h = el('div', 'sheet-head');
    h.appendChild(el('span', 'lbl big nomb', title));
    var x = el('button', 'sheet-close', '✕');
    x.type = 'button';
    x.dataset.close = '1';
    x.setAttribute('aria-label', '閉じる');
    h.appendChild(x);
    return h;
  }

  var returnFocusTo = null;

  /** title と中身のノードを渡すと、見出し・閉じるボタン・「やめる」を添えて開く。 */
  function open(title, content) {
    while (body.firstChild) body.removeChild(body.firstChild);
    body.appendChild(head(title));
    body.appendChild(content);
    var cancel = el('button', 'btn ghost', 'やめる');
    cancel.type = 'button';
    cancel.dataset.close = '1';
    body.appendChild(cancel);

    // aria-modal で背景は読み上げから消えるので、キーボードの居場所も中へ移す
    if (!isOpen()) returnFocusTo = document.activeElement;
    sheet.classList.add('open');
    bg.classList.add('open');
    sheet.scrollTop = 0;
    var first = body.querySelector('input,select,textarea,button:not([data-close])') ||
                body.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    sheet.classList.remove('open');
    bg.classList.remove('open');
    if (returnFocusTo && returnFocusTo.focus) returnFocusTo.focus({ preventScroll: true });
    returnFocusTo = null;
  }

  function isOpen() { return sheet.classList.contains('open'); }

  bg.addEventListener('click', close);
  sheet.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-close]')) close();
  });
  addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });

  // グリップを下へ引いて閉じる
  (function () {
    var y0 = null;
    var start = function (ev) { y0 = (ev.touches ? ev.touches[0] : ev).clientY; };
    var end = function (ev) {
      if (y0 === null) return;
      var y = (ev.changedTouches ? ev.changedTouches[0] : ev).clientY;
      if (y - y0 > 40) close();
      y0 = null;
    };
    grip.addEventListener('touchstart', start, { passive: true });
    grip.addEventListener('touchend', end);
    grip.addEventListener('mousedown', start);
    // グリップの外で指/ボタンを離しても拾えるように、離す側は window で受ける
    addEventListener('mouseup', end);
  })();

  return { open: open, close: close, isOpen: isOpen, body: body };
})();
