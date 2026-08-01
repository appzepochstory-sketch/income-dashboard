/**
 * views.js — データ → DOM の描画だけを持つ層。
 * 通信もフォーム送信も知らないので、デザインを差し替えるときはこのファイルと css/app.css を入れ替える。
 * 受け取る data は API の bootstrap 応答そのまま。
 */
window.IncViews = (function () {
  'use strict';

  var SERIES_VAR = ['--s1', '--s2', '--s3', '--s4'];

  function $(id) { return document.getElementById(id); }
  function yen(n) { return '¥' + Math.round(n || 0).toLocaleString('ja-JP'); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function sumTo(a, m) { return a.slice(0, m + 1).reduce(function (x, y) { return x + y; }, 0); }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function hero(S) {
    var m = S.thisMonth;
    $('heroLabel').textContent = S.year + '年' + (m + 1) + '月の手残り';
    var p = S.profit[m];
    var h = $('heroProfit');
    h.textContent = yen(p);
    h.className = 'hero-num' + (p < 0 ? ' minus' : '');
    $('heroIncome').textContent = yen(S.incomeTotal[m]);
    $('heroCost').textContent = yen(S.fixed[m] + S.expense[m]);
    $('ytdIncome').textContent = yen(sumTo(S.incomeTotal, m));
    $('ytdIncomeNote').textContent = '1〜' + (m + 1) + '月実績 / 通年 ' + yen(sum(S.incomeTotal));
    $('ytdProfit').textContent = yen(sumTo(S.profit, m));
    $('ytdProfitNote').textContent = '経費 ' + yen(sumTo(S.expense, m)) + ' / 固定費 ' + yen(sumTo(S.fixed, m));
  }

  /** 月次推移（収入4区分の積み上げ＋経費）。SVGを組み立てて差し込む。 */
  function chart(S) {
    var W = 700, H = 240, PAD_L = 8, PAD_B = 22, PAD_T = 10;
    var bw = (W - PAD_L * 2) / 12;
    var max = 0;
    for (var i = 0; i < 12; i++) max = Math.max(max, S.incomeTotal[i], S.fixed[i] + S.expense[i]);
    max = max || 1;
    var scale = (H - PAD_B - PAD_T) / max;
    var colors = SERIES_VAR.map(cssVar);
    var negC = cssVar('--neg');

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="月次収入推移">';
    for (var m = 0; m < 12; m++) {
      var x = PAD_L + bw * m + bw * 0.12;
      var w = bw * 0.5;
      var y = H - PAD_B;
      for (var k = 0; k < S.streams.length; k++) {
        var v = S.income[S.streams[k]][m];
        if (v <= 0) continue;
        var hgt = v * scale;
        y -= hgt;
        s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) +
             '" height="' + hgt.toFixed(1) + '" fill="' + colors[k] + '"/>';
      }
      var cost = S.fixed[m] + S.expense[m];
      if (cost > 0) {
        var ch = cost * scale;
        s += '<rect x="' + (x + w + bw * 0.06).toFixed(1) + '" y="' + (H - PAD_B - ch).toFixed(1) +
             '" width="' + (bw * 0.22).toFixed(1) + '" height="' + ch.toFixed(1) + '" fill="' + negC + '"/>';
      }
      s += '<text x="' + (x + bw * 0.3).toFixed(1) + '" y="' + (H - 7) +
           '" fill="' + (m === S.thisMonth ? '#ededed' : '#5c5c5c') + '" font-size="11" text-anchor="middle">' + (m + 1) + '</text>';
    }
    s += '<line x1="0" y1="' + (H - PAD_B) + '" x2="' + W + '" y2="' + (H - PAD_B) + '" stroke="#2b2b2b"/></svg>';
    $('chart').innerHTML = s;

    var lg = $('legend');
    clear(lg);
    S.streams.concat(['経費+固定費']).forEach(function (name, i) {
      var sp = el('span');
      var ic = el('i');
      ic.style.background = (i < SERIES_VAR.length) ? colors[i] : negC;
      sp.appendChild(ic);
      sp.appendChild(document.createTextNode(name));
      lg.appendChild(sp);
    });
  }

  function breakdown(S) {
    var m = S.thisMonth, box = $('breakdown');
    $('breakdownMonth').textContent = (m + 1) + '月';
    clear(box);
    var total = S.incomeTotal[m] || 1;
    S.streams.forEach(function (name, i) {
      var v = S.income[name][m];
      var d = el('div', 'brk');
      var top = el('div', 'brk-top');
      top.appendChild(el('span', null, name));
      top.appendChild(el('b', null, yen(v) + '　' + Math.round(v / total * 100) + '%'));
      var bar = el('div', 'brk-bar');
      var fill = el('i');
      fill.style.width = Math.max(0, Math.min(100, v / total * 100)) + '%';
      fill.style.background = cssVar(SERIES_VAR[i]);
      bar.appendChild(fill);
      d.appendChild(top);
      d.appendChild(bar);
      box.appendChild(d);
    });

    var prev = S.prevYearTotal[m], cur = S.incomeTotal[m], y = $('yoy');
    clear(y);
    if (prev > 0) {
      var diff = cur - prev;
      y.appendChild(document.createTextNode('前年同月比（Epochstory販売＋委託＋イラストのみ） '));
      y.appendChild(el('b', diff >= 0 ? 'up' : 'down', (diff >= 0 ? '+' : '') + Math.round(diff / prev * 100) + '%'));
      y.appendChild(document.createTextNode(' / 前年 ' + yen(prev)));
    } else {
      y.textContent = '前年同月の比較データなし（フリーランス収入は前年シート未対応）';
    }
  }

  function stock(S) {
    var box = $('stock');
    clear(box);
    if (!S.stock.length) { box.appendChild(el('div', 'empty', 'データなし')); return; }
    var t = el('table');
    var head = el('tr');
    ['委託先', '販売中', '売切', '在庫金額'].forEach(function (h, i) {
      head.appendChild(el('th', i ? 'n' : null, h));
    });
    t.appendChild(head);
    S.stock.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', null, r.place));
      tr.appendChild(el('td', 'n', String(r.onSale)));
      tr.appendChild(el('td', 'n', String(r.sold)));
      tr.appendChild(el('td', 'n', yen(r.stockValue)));
      t.appendChild(tr);
    });
    box.appendChild(t);
  }

  function pipeline(S) {
    var box = $('pipeline');
    clear(box);
    if (!S.pipeline.length) { box.appendChild(el('div', 'empty', '未納品の案件なし')); return; }
    var total = 0;
    S.pipeline.forEach(function (p) {
      total += p.price;
      box.appendChild(row(
        p.note || p.kind || ('案件' + p.id),
        p.ordered + ' 依頼 / ' + (p.client || '-') + ' / ' + (p.kind || '-'),
        [el('div', 'amount', yen(p.price)), el('span', 'tag' + (p.days > 60 ? ' hot' : ''), p.days + '日経過')]
      ));
    });
    box.appendChild(el('div', 'yoy', '未納品 ' + S.pipeline.length + '件 / 合計 ' + yen(total)));
  }

  /** 一覧の1行（タイトル / 補足 / 右側の要素群）。 */
  function row(title, sub, rightNodes) {
    var d = el('div', 'item');
    var m = el('div', 'item-m');
    m.appendChild(el('div', 'item-t', title));
    m.appendChild(el('div', 'item-s', sub));
    var r = el('div', 'item-r');
    rightNodes.forEach(function (n) { r.appendChild(n); });
    d.appendChild(m);
    d.appendChild(r);
    return d;
  }

  /** 委託一覧。onToggle(row, status, button) は app.js から渡す。 */
  function consign(S, filter, onToggle) {
    var box = $('consignList');
    clear(box);
    var rows = S.lists.consign.filter(function (r) { return filter === 'all' || r.status === filter; });
    if (!rows.length) { box.appendChild(el('div', 'empty', '該当なし')); return; }
    rows.slice(0, 120).forEach(function (r) {
      var btn = el('button', 'btn mini ' + (r.status === '売り切れ' ? 'ghost' : ''), r.status || '未設定');
      btn.onclick = function () { onToggle(r, btn); };
      box.appendChild(row(
        r.name,
        r.date + ' / ' + r.place + ' / ' + (r.kind || '-') + (r.size && r.size !== '-' ? ' ' + r.size : ''),
        [el('div', 'amount', yen(r.price)), btn]
      ));
    });
  }

  function fixed(S, onEdit) {
    var box = $('fixedList');
    clear(box);
    if (!S.lists.fixed.length) { box.appendChild(el('div', 'empty', 'まだ登録なし')); return; }
    var total = 0;
    S.lists.fixed.forEach(function (r) {
      total += r.amount;
      var b = el('button', 'btn mini ghost', '編集');
      b.onclick = function () { onEdit(r); };
      box.appendChild(row(
        r.name,
        (r.category || '-') + ' / ' + (r.payday || '支払日未設定') + (r.to ? ' / 〜' + r.to : ''),
        [el('div', 'amount', yen(r.amount)), b]
      ));
    });
    box.appendChild(el('div', 'yoy', '月額合計 ' + yen(total)));
  }

  function expense(S, onConfirm, onEdit) {
    var box = $('expenseList');
    clear(box);
    if (!S.lists.expense.length) { box.appendChild(el('div', 'empty', 'まだ登録なし')); return; }
    S.lists.expense.slice(0, 150).forEach(function (r) {
      var right = [el('div', 'amount', r.amount ? yen(r.amount) : '金額未入力')];
      if (r.status === '要確認') right.push(el('span', 'tag hot', '要確認'));
      if (r.confirmed) {
        right.push(el('span', 'tag', '確定'));
      } else {
        var b = el('button', 'btn mini', '確定する');
        b.onclick = function () { onConfirm(r, b); };
        right.push(b);
      }
      var ed = el('button', 'btn mini ghost', '編集');
      ed.onclick = function () { onEdit(r); };
      right.push(ed);
      box.appendChild(row(
        r.item || '(内訳なし)',
        r.date + ' / ' + (r.vendor || '-') + ' / ' + (r.category || '-') + (r.source ? ' / ' + r.source : ''),
        right
      ));
    });
  }

  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    setTimeout(function () { t.className = 'toast'; }, isErr ? 5200 : 2600);
  }

  return {
    hero: hero, chart: chart, breakdown: breakdown, stock: stock, pipeline: pipeline,
    consign: consign, fixed: fixed, expense: expense, toast: toast, yen: yen
  };
})();
