/**
 * app.js — 画面の配線。API（api.js）・描画（views.js）・フォーム（forms.js）をつなぐだけで、
 * 集計も HTML 組み立ても持たない。
 *
 * 入力の入口は下ナビ中央の「＋」ひとつ（案E）。押すとボトムシートが出て
 * イラスト案件／Epochstory販売 を選ぶ。ページは移動しない。
 * 委託・固定費・経費のフォームは、それぞれのタブに置いたまま（見てから書く並び）。
 */
(function () {
  'use strict';

  var S = null;                     // bootstrap の応答
  var cfg = window.INC_CONFIG;
  var selMonth = null;              // DASH で見ている月（0..11）。年の数字には効かせない
  var urlMonth = null;              // ?m= で開かれたときの初回だけの指定
  var consignFilter = 'all';
  var consignLimit = 8;
  var formsReady = false;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- 起動 ----------
  /**
   * 読み込み直し。合言葉まわりの失敗はゲートで伝えるところまでやり、
   * それ以外の失敗は「どう伝えるか」を呼び出し側に委ねる（同じ通信エラーでも、
   * 読むだけの失敗と「保存は済んでいるが表示だけ古い」では言うべきことが違うため）。
   */
  function boot(year) {
    return IncApi.bootstrap(year).then(show).catch(function (e) {
      // 合言葉が違う＝保存済みトークンが役に立たないので消して入力画面に戻す。
      // ロック中・未設定は入れ直しても直らないので、消さずにそのまま伝える。
      if (e.code === 'AUTH') { IncApi.forget(); openGate('合言葉が変わったみたい。入れ直してね。'); }
      else if (e.code === 'LOCKED' || e.code === 'SETUP') openGate(e.message);
      throw e;
    });
  }

  function handledByGate(e) {
    return e.code === 'AUTH' || e.code === 'LOCKED' || e.code === 'SETUP';
  }

  /** 読むのが目的のとき（起動・年の切替）。失敗の理由をそのまま出す。 */
  function reload(year) {
    return boot(year).catch(function (e) {
      if (!handledByGate(e)) IncViews.toast(e.message, true);
    });
  }

  /**
   * 書き込んだあとの読み直し。
   * ここで失敗しても「保存できなかった」ではなく「表示が古い」だけ。
   * 保存のエラーと同じ「もう一度試してね」を出すと、二重登録に誘導してしまう。
   */
  function reloadAfterWrite() {
    return boot(S.year).catch(function (e) {
      if (!handledByGate(e)) IncViews.toast('保存はできたよ。画面の更新だけ失敗したから、読み込み直してね。', true);
    });
  }

  function show(data) {
    // 年が変わったら、その年の「いちばん新しい月」に合わせ直す（前年を開いたら12月）。
    // 同じ年の読み直し（保存のあと）では、見ていた月を動かさない。
    var sameYear = S && S.year === data.year;
    S = data;
    if (urlMonth != null) { selMonth = urlMonth; urlMonth = null; }
    else if (selMonth == null || !sameYear) selMonth = S.thisMonth;

    $('gate').hidden = true;
    $('topwrap').hidden = false;
    $('app').hidden = false;
    $('nav').hidden = false;
    render();
  }

  function render() {
    fillYear();
    fillMonth();
    ensureForms();
    IncForms.refreshOptions(document, S.options);
    fillSquareItems();
    fillHints();

    renderMonth();
    IncViews.forecast(S);
    IncViews.stock(S);
    IncViews.pipeline(S);
    IncViews.consignPlaces(S);
    renderConsign();
    IncViews.fixed(S, editFixed);
    IncViews.expense(S, confirmExpense, editExpense);

    $('sheetLink').href = S.sheetUrl;
  }

  /** 月を選び直したときに描き直すのはこの3つだけ（年の数字とタブの一覧は動かさない）。 */
  function renderMonth() {
    IncViews.hero(S, selMonth);
    IncViews.breakdown(S, selMonth);
    drawChart();
  }

  function drawChart() {
    if (S && currentView() === 'dash') IncViews.chart(S, selMonth);
  }

  // ---------- 合言葉ゲート ----------
  function openGate(msg) {
    $('gate').hidden = false;
    $('topwrap').hidden = true;
    $('app').hidden = true;
    $('nav').hidden = true;
    var box = $('gateMsg');
    if (msg) { box.textContent = msg; box.classList.add('err'); }
  }

  /**
   * 合言葉の表示切替。見えないまま打って間違いに気づけないのが事故のもとだったので付けた。
   * 状態は「アイコンの形」と「ライムの下敷き」と aria-pressed の3つで示す。
   */
  (function () {
    var input = $('gatePass');
    var btn = $('gateEye');
    var icon = btn.querySelector('use');
    btn.addEventListener('click', function () {
      var reveal = (input.type === 'password');
      input.type = reveal ? 'text' : 'password';
      icon.setAttribute('href', reveal ? '#ic-eye-off' : '#ic-eye');
      btn.setAttribute('aria-label', reveal ? '合言葉を隠す' : '合言葉を表示');
      btn.setAttribute('aria-pressed', reveal ? 'true' : 'false');
      btn.classList.toggle('on', reveal);
      input.focus({ preventScroll: true });
    });
  })();

  $('gateForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = ev.target.querySelector('button');
    btn.disabled = true;
    $('gateMsg').textContent = '確認中…';
    $('gateMsg').classList.remove('err');
    IncApi.signIn($('gatePass').value).then(function (data) {
      $('gatePass').value = '';
      btn.disabled = false;
      show(data);
    }).catch(function (e) {
      btn.disabled = false;
      $('gateMsg').textContent = e.message;
      $('gateMsg').classList.add('err');
    });
  });

  // ---------- 年 / 月 ----------
  function fillYear() {
    var sel = $('year');
    if (!sel.options.length) {
      var now = new Date().getFullYear();
      for (var y = now + 1; y >= now - 3; y--) sel.appendChild(new Option(y + '年', y));
      sel.onchange = function () { reload(parseInt(sel.value, 10)); };
    }
    sel.value = S.year;
  }

  /** 月の選択。データは12ヶ月ぶん揃っているので、通信せず画面だけ描き直す。 */
  function fillMonth() {
    var sel = $('month');
    if (!sel.options.length) {
      for (var i = 0; i < 12; i++) sel.appendChild(new Option((i + 1) + '月', i));
      sel.onchange = function () { pickMonth(parseInt(sel.value, 10)); };
    }
    sel.value = selMonth;
  }

  /** 月を選び直す唯一の入口（セレクタもスワイプもここを通る）。範囲外は黙って捨てる。 */
  function pickMonth(m) {
    if (!S || !(m >= 0 && m <= 11) || m === selMonth) return;
    selMonth = m;
    $('month').value = m;
    renderMonth();
    syncUrl();
  }

  /**
   * hero の左右スワイプで前月／翌月。月セレクタは画面の右上＝右手の親指から一番遠い角にあり、
   * それが一番よく触る操作になってしまったので、毎日見る hero 自体を送り手にする。
   * hero は DASH にしか無いので、他タブに漏れることはない。
   *
   * ただし画面の左右端から始まったスワイプは拾わない。そこは iOS の「戻る／進む」の帯で、
   * hero の左端は viewport から 13px しか離れていないため、そのまま拾うと
   * 「前月に戻ろうとしてブラウザごと前のページに戻り、ついでに月も動いている」になる。
   * preventDefault で OS のジェスチャを奪いにいくと標準の操作を壊すうえ passive も外れるので、
   * こちらが譲る。真ん中から始めれば今までどおり効く（帯を除いても幅は 270px 残る）。
   */
  var EDGE_BAND = 24;   // iOS のエッジスワイプ判定はおよそ 20pt。少し広めに取って譲る

  (function () {
    var x0 = 0, y0 = 0, live = false;
    var hero = document.querySelector('.hero');
    hero.addEventListener('touchstart', function (ev) {
      var x = (ev.touches.length === 1) ? ev.touches[0].clientX : -1;
      live = (x >= EDGE_BAND && x <= document.documentElement.clientWidth - EDGE_BAND);
      if (!live) return;
      x0 = x;
      y0 = ev.touches[0].clientY;
    }, { passive: true });
    hero.addEventListener('touchend', function (ev) {
      if (!live) return;
      live = false;
      var t = ev.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      // 縦スクロールの途中で月が飛ぶのが最悪なので、横が縦の1.5倍を超えたときだけ効かせる
      if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      pickMonth(selMonth + (dx < 0 ? 1 : -1));
    }, { passive: true });
  })();

  // ---------- フォーム ----------
  /** タブ内の3つのフォームは1度だけ組み立てる（毎回作り直すと入力途中が消える）。 */
  function ensureForms() {
    if (formsReady) return;
    formsReady = true;
    [['consignForm', 'consign'], ['fixedForm', 'fixed'], ['expenseForm', 'expense']].forEach(function (p) {
      $(p[0]).appendChild(IncForms.build(p[1], S.options));
    });
    IncForms.wire(document);
  }

  function fillSquareItems() {
    var dl = $('dlSquareItems');
    while (dl.firstChild) dl.removeChild(dl.firstChild);
    (S.options.square.items || []).forEach(function (it) { dl.appendChild(new Option(it.name)); });
  }

  function fillHints() {
    var sq = S.options.square;
    var msg = sq.error
      ? 'Square商品を取れなかったよ: ' + sq.error + '（手入力でOK）'
      : 'Squareの商品 ' + (sq.items || []).length + '件から選べるよ';
    ['sqHint', 'sqHintSale'].forEach(function (id) { if ($(id)) $(id).textContent = msg; });
  }

  function formOf(key) { return document.querySelector('form[data-form="' + key + '"]'); }

  // 送信はどのフォームでも同じ流れ。シート内のフォームもここで拾う（submit は bubble する）。
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!form.dataset || !form.dataset.form) return;
    ev.preventDefault();
    submitForm(form);
  });

  function submitForm(form) {
    var def = IncForms.defs[form.dataset.form];
    var gap = IncForms.missing(form);
    if (gap) {
      IncViews.toast('「' + gap.label + '」が空だよ');
      gap.input.focus();
      return;
    }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    IncApi.call(def.action, IncForms.values(form)).then(function () {
      IncViews.toast(def.okMsg);
      IncForms.reset(form);           // hidden の row / expected もここで必ず空になる
      btn.disabled = false;
      if (IncSheet.isOpen()) IncSheet.close();
      reloadAfterWrite();
    }).catch(function (e) {
      btn.disabled = false;
      IncViews.toast(e.message, true);
    });
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-reset]');
    if (!btn) return;
    IncForms.reset(btn.closest('form'));
  });

  // ---------- 追加シート（ナビ中央の＋） ----------
  function pickCard(key, sub, alt) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pickcard' + (alt ? ' alt' : '');
    b.dataset.pick = key;
    b.setAttribute('aria-label', IncForms.defs[key].title + 'を追加する');
    b.innerHTML = '<span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#' +
      (key === 'illust' ? 'ic-input' : 'ic-consign') + '"/></svg></span>';
    var tx = document.createElement('span');
    tx.className = 'tx';
    var b1 = document.createElement('b');
    b1.textContent = IncForms.defs[key].title;
    var s1 = document.createElement('span');
    s1.textContent = sub;
    tx.appendChild(b1);
    tx.appendChild(s1);
    b.appendChild(tx);
    b.onclick = function () { openAddForm(key); };
    return b;
  }

  function openPicker() {
    var box = document.createDocumentFragment();
    box.appendChild(pickCard('illust', '依頼日・納品日・価格', false));
    box.appendChild(pickCard('sale', '対面で売れた分', true));
    IncSheet.open('なにを追加する？', box);
  }

  function openAddForm(key) {
    var plate = document.createElement('div');
    plate.className = 'plate';
    plate.appendChild(IncForms.build(key, S.options, { bare: true, lime: true }));
    IncSheet.open(IncForms.defs[key].title, plate);
    IncForms.wire(IncSheet.body);
    fillHints();   // #sqHintSale はこのシートを開いた時に初めて生まれる（render では間に合わない）
  }

  // ---------- 委託 ----------
  function renderConsign() {
    IncViews.consignFilters(S, consignFilter, function (v) {
      consignFilter = v;
      consignLimit = 8;
      renderConsign();
    });
    IncViews.consign(S, consignFilter, consignLimit, toggleConsign, function () {
      consignLimit += 12;
      renderConsign();
    });
  }

  function toggleConsign(r, btn) {
    btn.disabled = true;
    // expected を渡すと、画面が古いまま上書きするのをサーバ側が弾く
    IncApi.call('toggleConsign', { row: r.row, expected: r.status })
      .then(function (res) { IncViews.toast('→ ' + res.status); reloadAfterWrite(); })
      .catch(function (e) { btn.disabled = false; IncViews.toast(e.message, true); });
  }

  // ---------- 固定費 / 経費 ----------
  // 固定費・経費のタブにはID列が無いので、行番号だけを送ると
  // シート側で行を消したあとに開きっぱなしのタブから保存したとき、別の行を潰してしまう。
  // そこでサーバが各行に付けてくる指紋（r.print）をそのまま送り返し、同じ行かを確かめてもらう。
  function editFixed(r) { startEdit('fixed', 'fixedFormBox', r); }
  function editExpense(r) { startEdit('expense', 'expenseFormBox', r); }

  function startEdit(key, boxId, record) {
    IncForms.fill(formOf(key), record);
    $(boxId).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function confirmExpense(r, btn) {
    btn.disabled = true;
    IncApi.call('confirmExpense', { row: r.row, expected: r.print || '' })
      .then(function () { IncViews.toast('確定にしたよ'); reloadAfterWrite(); })
      .catch(function (e) { btn.disabled = false; IncViews.toast(e.message, true); });
  }

  // ---------- ナビ / ?tab= ----------
  function currentView() {
    var on = document.querySelector('#nav button.on');
    return on ? on.dataset.go : cfg.views[0];
  }

  function setView(name) {
    document.querySelectorAll('#nav button[data-go]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.go === name);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.hidden = (v.dataset.view !== name);
    });
    // 月が効くのは DASH だけ。他タブでも押せるままにすると、押した瞬間は何も起きず
    // 裏で DASH だけが書き換わる（＝次に DASH を開くと月が変わっている）という一番読み違える形になる。
    // 年は全タブに効くのでそのまま。
    var monthOn = (name === cfg.views[0]);
    $('month').disabled = !monthOn;
    $('monthWrap').classList.toggle('off', !monthOn);
    window.scrollTo(0, 0);
    drawChart();
  }

  /** いまの画面をそのまま開き直せるURLにしておく（タブと月の両方を載せる）。 */
  function syncUrl() {
    var q = '?tab=' + currentView();
    if (selMonth != null) q += '&m=' + (selMonth + 1);
    history.replaceState(null, '', q);
  }

  document.querySelectorAll('#nav button[data-go]').forEach(function (b) {
    b.onclick = function () {
      setView(b.dataset.go);
      syncUrl();
    };
  });
  document.querySelector('#nav button[data-add]').onclick = function () {
    if (S) openPicker();
  };

  // 装飾のステッカーが読めなかったときは黙って消す（無くても画面は成立する）。
  // img は body の上の方にあり、この配線はファイル末尾で走るので、
  // 読み込みに失敗した error はリスナが付く前に飛び終わっていることがある。
  // 付け終わったあとに「もう落ちていたもの」を拾い直さないと、壊れた <img> が残る。
  document.querySelectorAll('img.stick').forEach(function (img) {
    img.addEventListener('error', function () { img.remove(); });
    if (img.complete && !img.naturalWidth) img.remove();
  });

  // ナビの実寸を本文の下余白に反映（＋のぶんだけ高さが変わるため）
  function syncNavHeight() {
    var h = Math.ceil($('nav').getBoundingClientRect().height);
    if (h) document.documentElement.style.setProperty('--nav-h', (h + 4) + 'px');
  }

  var resizeTimer;
  addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      syncNavHeight();
      drawChart();
    }, 150);
  });

  /**
   * ?tab= / ?m= の入口。旧レイアウトの ?tab=input は画面が無くなったので、
   * DASH を出したうえで追加シートを開く（リンクが死なないように）。
   * 月は 1〜12 の範囲外・数字以外なら黙って捨てて、その年の最新月で開く。
   */
  function initView() {
    var q = new URLSearchParams(location.search);
    var tab = (q.get('tab') || '').toLowerCase();
    var m = parseInt(q.get('m'), 10);
    if (m >= 1 && m <= 12) urlMonth = m - 1;
    if (tab === cfg.addTab) return { view: cfg.views[0], add: true };
    return { view: cfg.views.indexOf(tab) >= 0 ? tab : cfg.views[0], add: false };
  }

  var start = initView();
  setView(start.view);
  if (IncApi.hasToken()) {
    reload().then(function () {
      if (S && start.add) openPicker();
    });
  } else {
    openGate();
  }
  requestAnimationFrame(function () {
    syncNavHeight();
    // 初回は幅が 0 で読めることがあるので、レイアウト確定後にもう一度描く
    requestAnimationFrame(drawChart);
  });
})();
