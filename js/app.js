/**
 * app.js — 画面の配線。API（api.js）と描画（views.js）をつなぐだけで、
 * 集計もHTML組み立ても持たない。
 */
(function () {
  'use strict';

  var S = null;                 // bootstrap の応答
  var consignFilter = 'all';
  var cfg = window.INC_CONFIG;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- 起動 ----------
  function boot(year) {
    return IncApi.bootstrap(year).then(show).catch(function (e) {
      // 合言葉が違う＝保存済みトークンが役に立たないので消して入力画面に戻す。
      // ロック中・未設定は入れ直しても直らないので、消さずにそのまま伝える。
      if (e.code === 'AUTH') { IncApi.forget(); openGate('合言葉が変わったみたい。入れ直してね。'); }
      else if (e.code === 'LOCKED' || e.code === 'SETUP') openGate(e.message);
      else IncViews.toast(e.message, true);
      throw e;
    });
  }

  function show(data) {
    S = data;
    $('gate').hidden = true;
    document.querySelector('.hd').hidden = false;
    $('app').hidden = false;
    $('nav').hidden = false;
    render();
  }

  function render() {
    fillYear();
    fillOptions();
    IncViews.hero(S);
    IncViews.chart(S);
    IncViews.breakdown(S);
    IncViews.stock(S);
    IncViews.pipeline(S);
    renderConsign();
    IncViews.fixed(S, editFixed);
    IncViews.expense(S, confirmExpense, editExpense);
    $('sheetLink').href = S.sheetUrl;
  }

  // ---------- 合言葉ゲート ----------
  function openGate(msg) {
    $('gate').hidden = false;
    $('app').hidden = true;
    $('nav').hidden = true;
    document.querySelector('.hd').hidden = true;
    if (msg) $('gateMsg').textContent = msg;
  }

  $('gateForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = ev.target.querySelector('button');
    btn.disabled = true;
    $('gateMsg').textContent = '確認中…';
    IncApi.signIn($('gatePass').value).then(function (data) {
      $('gatePass').value = '';
      btn.disabled = false;
      show(data);
    }).catch(function (e) {
      btn.disabled = false;
      $('gateMsg').textContent = e.message;
    });
  });

  // ---------- 選択肢 ----------
  function fillSelect(sel, values) {
    var current = sel.value;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    sel.appendChild(new Option('', ''));
    (values || []).forEach(function (v) { sel.appendChild(new Option(v, v)); });
    if (sel.dataset.allowNew) sel.appendChild(new Option('＋ 新しく追加…', '__new'));
    if (current) sel.value = current;
  }

  /** 「＋新しく追加」を選んだときだけ、その場に自由入力欄を出す。 */
  function newInputFor(sel) {
    var next = sel.nextElementSibling;
    if (next && next.classList.contains('newin')) return next;
    var input = document.createElement('input');
    input.className = 'newin';
    input.placeholder = '新しい値を入力';
    input.hidden = true;
    sel.parentNode.insertBefore(input, sel.nextSibling);
    sel.addEventListener('change', function () { input.hidden = (sel.value !== '__new'); });
    return input;
  }

  function fillOptions() {
    var o = S.options;
    document.querySelectorAll('select[data-options]').forEach(function (sel) {
      fillSelect(sel, o[sel.dataset.options]);
      if (sel.dataset.allowNew) newInputFor(sel);
    });

    var dl = $('dlSquareItems');
    while (dl.firstChild) dl.removeChild(dl.firstChild);
    (o.square.items || []).forEach(function (it) { dl.appendChild(new Option(it.name)); });

    var sqMsg = o.square.error
      ? 'Square商品を取得できなかったよ: ' + o.square.error + '（手入力でOK）'
      : 'Squareの商品 ' + o.square.items.length + '件から選べるよ';
    ['sqHint', 'sqHintSale'].forEach(function (id) { if ($(id)) $(id).textContent = sqMsg; });
    $('custHint').textContent = '顧客情報タブ ' + o.customers.length + '件（備考欄で取引先名を入力）';
  }

  function fillYear() {
    var sel = $('year');
    if (sel.options.length) { sel.value = S.year; return; }
    var now = new Date().getFullYear();
    for (var y = now + 1; y >= now - 3; y--) sel.appendChild(new Option(y + '年', y));
    sel.value = S.year;
    sel.onchange = function () { boot(parseInt(sel.value, 10)).catch(function () {}); };
  }

  // ---------- 委託 ----------
  function renderConsign() {
    var f = $('consignFilters');
    if (!f.children.length) {
      [['all', 'すべて'], ['販売中', '販売中'], ['売り切れ', '売切']].forEach(function (p) {
        var b = document.createElement('button');
        b.textContent = p[1];
        b.className = (p[0] === consignFilter) ? 'on' : '';
        b.onclick = function () {
          consignFilter = p[0];
          Array.prototype.forEach.call(f.children, function (c) { c.className = ''; });
          b.className = 'on';
          IncViews.consign(S, consignFilter, toggleConsign);
        };
        f.appendChild(b);
      });
    }
    IncViews.consign(S, consignFilter, toggleConsign);
  }

  function toggleConsign(r, btn) {
    btn.disabled = true;
    // expected を渡すと、画面が古いまま上書きするのをサーバ側が弾く
    IncApi.call('toggleConsign', { row: r.row, expected: r.status })
      .then(function (res) { IncViews.toast('→ ' + res.status); return boot(S.year); })
      .catch(function (e) { btn.disabled = false; IncViews.toast(e.message, true); });
  }

  // ---------- 固定費 / 経費 ----------
  // 固定費・経費のタブにはID列が無いので、行番号だけを送ると
  // シート側で行を消したあとに開きっぱなしのタブから保存したとき、別の行を潰してしまう。
  // そこでサーバが各行に付けてくる指紋（r.print）をそのまま送り返し、
  // サーバ側で同じ行かを確かめてもらう。画面では組み立てない
  // （同じ文字列を2箇所で作ると、セルの型ひとつで食い違って保存できなくなる）。
  function editFixed(r) {
    var f = $('fFixed');
    ['row', 'name', 'amount', 'payday', 'category', 'from', 'to', 'note'].forEach(function (k) {
      f[k].value = r[k] == null ? '' : r[k];
    });
    f.expected.value = r.print || '';
    $('fixedFormTitle').textContent = '固定費を編集（' + r.name + '）';
    window.scrollTo(0, 0);
  }

  function editExpense(r) {
    var f = $('fExpense');
    ['row', 'date', 'item', 'vendor', 'amount', 'category', 'method', 'ref', 'source', 'status'].forEach(function (k) {
      f[k].value = r[k] == null ? '' : r[k];
    });
    f.expected.value = r.print || '';
    f.confirmed.checked = !!r.confirmed;
    $('expFormTitle').textContent = '経費を編集';
    window.scrollTo(0, 0);
  }

  function confirmExpense(r, btn) {
    btn.disabled = true;
    IncApi.call('confirmExpense', { row: r.row, expected: r.print || '' })
      .then(function () { IncViews.toast('確定にしたよ'); return boot(S.year); })
      .catch(function (e) { btn.disabled = false; IncViews.toast(e.message, true); });
  }

  $('fixedReset').onclick = function () {
    $('fFixed').reset();
    $('fFixed').row.value = '';
    $('fFixed').expected.value = '';
    $('fixedFormTitle').textContent = '固定費を追加';
  };
  $('expReset').onclick = function () {
    $('fExpense').reset();
    $('fExpense').row.value = '';
    $('fExpense').expected.value = '';
    $('fExpense').status.value = '';
    $('expFormTitle').textContent = '経費を追加';
  };

  // ---------- フォーム送信 ----------
  function formData(f) {
    var o = {};
    Array.prototype.forEach.call(f.elements, function (e) {
      if (!e.name) return;
      if (e.type === 'checkbox') { o[e.name] = e.checked; return; }
      // 「＋新しく追加」を選んでいたら、隣の自由入力欄の値を送る
      if (e.value === '__new') {
        var extra = e.nextElementSibling;
        o[e.name] = (extra && extra.classList.contains('newin')) ? extra.value.trim() : '';
        return;
      }
      o[e.name] = e.value;
    });
    return o;
  }

  function bind(formId, action, okMsg, afterReset) {
    $(formId).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      IncApi.call(action, formData(f)).then(function () {
        IncViews.toast(okMsg);
        f.reset();
        if (afterReset) afterReset();
        btn.disabled = false;
        return boot(S.year);
      }).catch(function (e) {
        btn.disabled = false;
        IncViews.toast(e.message, true);
      });
    });
  }
  bind('fIllust', 'addIllust', 'イラスト案件を追加したよ');
  bind('fSale', 'addSale', 'Epochstory販売に追加したよ');
  bind('fConsign', 'addConsign', '委託商品を追加したよ');
  bind('fFixed', 'saveFixed', '固定費を保存したよ', function () { $('fixedFormTitle').textContent = '固定費を追加'; });
  bind('fExpense', 'saveExpense', '経費を保存したよ', function () { $('expFormTitle').textContent = '経費を追加'; });

  // ---------- ナビ / ?tab= ----------
  function setView(name) {
    document.querySelectorAll('#nav button').forEach(function (b) {
      b.className = (b.dataset.go === name) ? 'on' : '';
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.hidden = (v.dataset.view !== name);
    });
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('#nav button').forEach(function (b) {
    b.onclick = function () {
      setView(b.dataset.go);
      history.replaceState(null, '', '?tab=' + b.dataset.go);
    };
  });

  function initView() {
    var v = (new URLSearchParams(location.search).get('tab') || '').toLowerCase();
    return cfg.views.indexOf(v) >= 0 ? v : cfg.views[0];
  }

  setView(initView());
  if (IncApi.hasToken()) boot().catch(function () { /* boot 内で表示済み */ });
  else openGate();
})();
