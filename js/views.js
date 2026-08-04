/**
 * views.js — データ → DOM の描画だけを持つ層。通信もフォーム送信も知らない。
 * 受け取る S は API の bootstrap 応答そのまま。数値はここで作らず、すべて S から導く。
 *
 * 表示の掟（design/20260801_収入ダッシュボード_UIモック.html から移植）:
 *   数字は不透明な紙プレートの上にだけ置く。装飾はプレートの外側。
 *   傾けるのはラベル・テープ・ステッカーとプレートの下敷きだけで、数字は常に水平。
 *
 * シート由来の文字列（商品名・取引先など）は textContent で入れる。
 * innerHTML を使うのは、自前で組んだ数値だけの SVG（チャート）に限る。
 */
window.IncViews = (function () {
  'use strict';

  var SERIES_KEY = ['s1', 's2', 's3', 's4'];

  function $(id) { return document.getElementById(id); }
  function color(key) { return window.INC_CONFIG.palette[key]; }
  function yen(n) { return '¥' + Math.round(n || 0).toLocaleString('ja-JP'); }
  function dot(s) { return String(s || '').replace(/-/g, '.'); }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function sumTo(a, m) { return a.slice(0, m + 1).reduce(function (x, y) { return x + y; }, 0); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function put(node, children) {
    clear(node);
    children.forEach(function (c) { node.appendChild(c); });
  }

  /**
   * 金額は「¥」だけ小さく置く（数字の桁を主役にする）。
   * マイナスは「¥-1,234」ではなく「−¥1,234」。符号は通貨記号の前に出す
   * （一覧の .amt も同じ並びなので、赤字の月を選んだときに書式がぶれない）。
   */
  function bigYen(n) {
    var v = Math.round(n || 0);
    var frag = document.createDocumentFragment();
    if (v < 0) frag.appendChild(document.createTextNode('−'));
    frag.appendChild(el('small', null, '¥'));
    frag.appendChild(document.createTextNode(Math.abs(v).toLocaleString('ja-JP')));
    return frag;
  }

  /** 「A・B・C」形式の補足。空の項目は '-' を並べずに落とす。 */
  function meta(parts, sep) {
    return parts.filter(function (v) { return v && v !== '-'; }).join(sep || '・');
  }

  /** 一覧の1行。cls は右側の並べ方（既定は縦積み、'row-r h' で横並び）。 */
  function row(title, sub, rightNodes, cls) {
    var d = el('div', 'row');
    var m = el('div', 'row-m');
    m.appendChild(el('div', 'row-t', title));
    if (sub != null) m.appendChild(el('div', 'row-s', sub));
    var r = el('div', cls || 'row-r');
    rightNodes.forEach(function (n) { r.appendChild(n); });
    d.appendChild(m);
    d.appendChild(r);
    return d;
  }

  /** 操作ボタンを持つ行。金額と操作を本文の下に回し、本文に全幅を渡す。 */
  function actionRow(title, sub, rightNodes) {
    var d = row(title, sub, rightNodes, 'row-r');
    d.classList.add('stack');
    return d;
  }

  function chip(label, value, isNeg) {
    var c = el('div', 'chipnum' + (isNeg ? ' neg' : ''));
    c.appendChild(document.createTextNode(label));
    c.appendChild(el('b', null, yen(value)));
    return c;
  }

  // ---------- DASH 上段 ----------

  /** 選んだ月がまだ来ていない＝実績が入りようがない月かどうか。 */
  function isFuture(S, m) {
    var now = new Date();
    if (S.year > now.getFullYear()) return true;
    return S.year === now.getFullYear() && m > S.thisMonth;
  }

  /**
   * 選んだ年がまるごと先＝1ヶ月も実績が無い年かどうか。
   * サーバは当年以外に `thisMonth: 11` を返す（`Api.gs`）ので、`thisMonth` だけを見ると
   * 過去年と未来年が同じ顔になり、**未来年の確定分を「実績」と書いてしまう**。
   * 年をまたぐ判定はここに集約して、`thisMonth` 基準の分岐と混ぜない。
   */
  function isFutureYear(S) { return isFuture(S, 0); }

  /**
   * 見ている年の呼び方。年セレクタで前後の年も開けるので、「今年の」と書けるのは当年だけ。
   * 2027年を開いたまま「今年の手残り」と出ていると、選んでいる年について嘘をつく。
   * 当年のときの文言は変えない（毎日見るのはそこなので、日常の見え方を動かさない）。
   */
  function yearWord(S) {
    return S.year === new Date().getFullYear() ? '今年の' : S.year + '年の';
  }

  /**
   * 上段。m は画面で選んでいる月で、下段の「今年の…」は m に連動させない。
   * 連動させると「今年の総収入」が過去月を選ぶたびに減り、年の数字の意味が壊れる。
   */
  function hero(S, m) {
    var latest = S.thisMonth;
    $('heroWord').textContent = (m + 1) + '月';
    $('heroLabel').textContent =
      (S.year === new Date().getFullYear() && m === latest) ? '今月の手残り' : (m + 1) + '月の手残り';
    // 先の月にも「フリーランス収入」の確定分だけは入っている。
    // 数字が出ること自体は正しいので、実績と取り違えないように但し書きを添える。
    $('heroYm').textContent = S.year + '.' + String(m + 1).padStart(2, '0') +
      (isFuture(S, m) ? '・確定分だけ' : '');

    var profit = S.profit[m];
    var num = $('heroNum');
    clear(num);
    num.className = 'hero-num' + (profit < 0 ? ' neg' : '');
    num.appendChild(bigYen(profit));

    put($('heroSub'), [
      chip('収入', S.incomeTotal[m], false),
      chip('経費', S.expense[m], true),
      chip('固定費', S.fixed[m], true)
    ]);

    $('ytdIncomeLabel').textContent = yearWord(S) + '総収入';
    $('ytdProfitLabel').textContent = yearWord(S) + '手残り';

    var ytdIncome = $('ytdIncome');
    clear(ytdIncome);
    ytdIncome.appendChild(bigYen(sumTo(S.incomeTotal, latest)));
    // 来年を選ぶと latest は 12月になるが、中身は確定分だけ。ここで「実績」と書くと嘘になる
    $('ytdIncomeNote').textContent = '1〜' + (latest + 1) + '月の' + (isFutureYear(S) ? '確定分' : '実績');

    var ytdProfit = $('ytdProfit');
    clear(ytdProfit);
    ytdProfit.appendChild(bigYen(sumTo(S.profit, latest)));
    $('ytdProfitNote').textContent = '経費 ' + yen(sumTo(S.expense, latest)) +
      ' / 固定費 ' + yen(sumTo(S.fixed, latest)) + ' を引いた額';
  }

  /**
   * 年末までの着地。「ランレート」ではないのでラベルを勝手に変えないこと。
   * 定義＝実績（1〜今月）＋ 確定している残り月の収入。
   * 残り月の値はシートの「フリーランス収入」に入っている確定分だけで、
   * 物販とイラスト案件は受注前なので 0 のまま入っている（＝画面に定数は持たない）。
   */
  function forecast(S) {
    var m = S.thisMonth;
    var landing = sum(S.incomeTotal);
    var confirmed = landing - sumTo(S.incomeTotal, m);
    var remain = 11 - m;
    $('forecast').textContent = yen(landing);
    // 来年は実績が1ヶ月も無い。remain だけで見ると「12ヶ月ぶんの実績」になってしまう
    $('forecastNote').textContent = isFutureYear(S)
      ? '12ヶ月ぶんの確定分（実績はまだ1ヶ月も無い）'
      : remain > 0
        ? '1〜' + (m + 1) + '月の実績 ＋ 残り' + remain + 'ヶ月の確定分 ' + yen(confirmed) + '（物販とイラスト案件は受注前なので0で計算）'
        : '12ヶ月ぶんの実績（残り月なし）';
  }

  /**
   * 月次推移。viewBox を実表示幅に合わせる＝1単位=1px で文字が縮まない。
   * 中身は自前の数値と PALETTE だけなので innerHTML で差し込んで問題ない。
   *
   * 既定で描くのは実績のある latest 月まで。先の月を選んだときだけそこまで伸ばす
   * （伸びた月に入っているのは確定済みのフリーランス収入だけなので、その旨を見出しに出す）。
   */
  function chart(S, m) {
    var box = $('chartbox');
    var latest = S.thisMonth;
    var last = Math.max(latest, m);
    // 但し書きは短く保つ。長いと 320px で見出しの2行目が伸びる。
    // 来年は latest が 12月まで来てしまうので、last と latest の比較だけでは但し書きが消える
    $('chartSub').textContent = '1〜' + (last + 1) + '月・積み上げ' +
      (isFutureYear(S) ? '（ぜんぶ確定分）'
        : last > latest ? '（' + (latest + 2) + '月〜は確定分）' : '');

    var raw = box.getBoundingClientRect().width;
    // 計測不能（0付近）のときだけ既定値。下限で丸めると狭い画面で 1:1 が崩れる
    var W = raw > 120 ? Math.round(raw) : 300;
    var H = 264;
    // PB は「月ラベル＋当月マーク＋単位キャプション」が重ならない高さ
    var PL = 40, PR = 6, PT = 16, PB = 54;
    var plotW = W - PL - PR, plotH = H - PT - PB;

    var peak = 0;
    for (var i = 0; i <= last; i++) {
      peak = Math.max(peak, S.incomeTotal[i], S.fixed[i] + S.expense[i]);
    }
    // データ由来。棒が突き抜けず、かつ上に空き帯を作らない高さ
    var max = Math.ceil((peak || 1) / 100000) * 100000 + 100000;
    var step = max > 800000 ? 400000 : 200000;
    var y = function (v) { return PT + plotH - (v / max) * plotH; };
    var pitch = plotW / (last + 1);
    var bw = Math.min(22, pitch * 0.44), cw = Math.min(9, pitch * 0.18);
    var ink = color('ink'), ink2 = color('ink2'), ink3 = color('ink3');
    // 12ヶ月を 320px に並べると、2桁の月ラベルが 1.3px 間隔まで詰まって「101112」と読める。
    // 幅が足りないときだけ文字と選択枠を落とす（375px は pitch 22.7 なので今までどおり）。
    // 月ラベルが2段なのは、320px の pitch 18 では 10px でも 2桁が 3.9px 間隔まで寄るため。
    var tight = pitch < 22;
    var moFs = pitch < 20 ? 9 : tight ? 10 : 12;
    var valFs = tight ? 9 : 11, pickW = tight ? 20 : 26;

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
            '" role="img" aria-label="月次の収入内訳と経費の推移">';
    for (var v = 0; v <= max; v += step) {
      s += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + y(v) + '" y2="' + y(v) +
           '" stroke="' + ink + '" stroke-width="' + (v === 0 ? 2 : 1) +
           '" stroke-dasharray="' + (v === 0 ? '' : '3 4') + '" opacity="' + (v === 0 ? 1 : .32) + '"/>';
      s += '<text x="' + (PL - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" font-weight="800" fill="' +
           ink2 + '">' + (v / 10000) + '万</text>';
    }
    for (var mo = 0; mo <= last; mo++) {
      var gx = PL + pitch * mo + pitch / 2;
      var bx = gx - bw / 2 - cw / 2 - 2;
      var acc = 0;
      for (var k = 0; k < S.streams.length; k++) {
        var val = S.income[S.streams[k]][mo];
        if (!val) continue;
        var h = (val / max) * plotH;
        s += '<rect x="' + bx.toFixed(1) + '" y="' + (y(acc) - h).toFixed(1) + '" width="' + bw.toFixed(1) +
             '" height="' + h.toFixed(1) + '" fill="' + color(SERIES_KEY[k] || 's1') +
             '" stroke="' + ink + '" stroke-width="1.4"/>';
        acc += val;
      }
      var cost = S.fixed[mo] + S.expense[mo];
      if (cost > 0) {
        var ch = (cost / max) * plotH;
        s += '<rect x="' + (bx + bw + 3).toFixed(1) + '" y="' + (y(0) - ch).toFixed(1) + '" width="' + cw.toFixed(1) +
             '" height="' + ch.toFixed(1) + '" fill="' + color('neg') + '" stroke="' + ink + '" stroke-width="1.4"/>';
      }
      if (acc > 0) {
        s += '<text x="' + gx.toFixed(1) + '" y="' + (y(acc) - 7).toFixed(1) +
             '" text-anchor="middle" font-size="' + valFs + '" font-weight="900" fill="' + ink + '">' +
             Math.round(acc / 10000) + '</text>';
      }
      // 選んでいる月をライムの枠で示す（月セレクタと一対一で対応させる）
      if (mo === m) {
        s += '<rect x="' + (gx - pickW / 2).toFixed(1) + '" y="' + (H - PB + 11) + '" width="' + pickW +
             '" height="20" fill="' + color('lime') + '" stroke="' + ink + '" stroke-width="2.4"/>';
      }
      s += '<text x="' + gx.toFixed(1) + '" y="' + (H - PB + 25) +
           '" text-anchor="middle" font-size="' + moFs + '" font-weight="900" fill="' + ink + '">' + (mo + 1) + '</text>';
    }
    s += '<text x="' + (W - PR) + '" y="' + (H - 3) + '" text-anchor="end" font-size="11" font-weight="800" fill="' +
         ink3 + '">単位：万円／細い赤は経費＋固定費</text></svg>';
    box.innerHTML = s;

    put($('legend'), S.streams.map(function (name, i) {
      return legendChip(name, color(SERIES_KEY[i] || 's1'));
    }).concat([legendChip('経費+固定費', color('neg'))]));
  }

  function legendChip(name, bg) {
    var b = el('b');
    var i = el('i');
    i.style.background = bg;
    b.appendChild(i);
    b.appendChild(document.createTextNode(name));
    return b;
  }

  function breakdown(S, m) {
    var total = S.incomeTotal[m];
    // 先の月に入っているのは確定済みのフリーランス収入だけ。hero と月次推移に合わせて
    // ここにも但し書きを出す（出さないと、実績が揃った前年と割って成長率のように読めてしまう）
    var future = isFuture(S, m);
    $('breakdownLabel').textContent = (m + 1) + '月の内訳' + (future ? '・確定分だけ' : '');

    var box = $('breakdown');
    clear(box);
    S.streams.forEach(function (name, i) {
      var v = S.income[name][m];
      var pct = total ? Math.round(v / total * 100) : 0;
      var d = el('div', 'brk');
      var top = el('div', 'brk-t');
      var left = el('span', null, name);
      left.appendChild(el('em', null, pct + '%'));
      top.appendChild(left);
      top.appendChild(el('b', null, yen(v)));
      var bar = el('div', 'brk-bar');
      var fill = el('i');
      fill.style.width = (total ? Math.max(0, Math.min(100, v / total * 100)) : 0) + '%';
      fill.style.background = color(SERIES_KEY[i] || 's1');
      bar.appendChild(fill);
      d.appendChild(top);
      d.appendChild(bar);
      box.appendChild(d);
    });

    var prev = S.prevYearTotal[m];
    // 長い注記を入れると金額と噛み合わずに行が崩れるので短く保つ。
    // 未来月は「確定分だけ ÷ 実績が揃った前年」なので、割合を出しても意味を持たない（桁違いの伸び率になる）
    var sub = future
      ? '確定分だけなので前年比較はしない'
      : prev > 0
        ? '前年同月 ' + yen(prev) + ' → ' + (total - prev >= 0 ? '+' : '') + Math.round((total - prev) / prev * 100) + '%'
        : '前年比較はまだなし';
    box.appendChild(row((m + 1) + '月の収入', sub, [el('span', 'amt', yen(total))], 'row-r h'));
    box.lastChild.classList.add('brk-sum');
  }

  function stock(S) {
    var places = S.stock.length;
    var onSale = 0, sold = 0, value = 0;
    S.stock.forEach(function (r) { onSale += r.onSale; sold += r.sold; value += r.stockValue; });

    $('stockSub').textContent = places + '店・' + (onSale + sold) + '点';
    put($('stockStat'), [
      statCell('あずけ中', onSale + sold),
      statCell('販売中', onSale, true),
      statCell('売り切れ', sold)
    ]);

    var box = $('stockList');
    clear(box);
    if (!places) { box.appendChild(el('div', 'empty', 'まだ委託なし')); return; }
    S.stock.forEach(function (r) {
      box.appendChild(row(r.place, 'あずけ ' + (r.onSale + r.sold) + '点・在庫 ' + yen(r.stockValue), [
        el('span', 'tag on', '販売中 ' + r.onSale),
        el('span', 'tag sold', '売り切れ ' + r.sold)
      ], 'row-r h'));
    });
  }

  function statCell(label, value, pick) {
    var d = el('div', pick ? 'pick' : null);
    d.appendChild(el('span', null, label));
    d.appendChild(el('b', null, String(value)));
    return d;
  }

  function pipeline(S) {
    var box = $('pipeline');
    clear(box);
    if (!S.pipeline.length) { box.appendChild(el('div', 'empty', '未納品の案件なし')); return; }
    var total = 0;
    S.pipeline.forEach(function (p) {
      total += p.price;
      box.appendChild(row(
        p.note || p.kind || ('案件 ' + p.id),
        meta([meta([p.kind, p.client]), '依頼 ' + dot(p.ordered) + '（' + p.days + '日経過）'], '／'),
        [el('span', 'amt', yen(p.price)), el('span', 'tag' + (p.days > 60 ? ' hot' : ''), '未納品')]
      ));
    });
    box.appendChild(el('div', 'foot', '進行中 ' + S.pipeline.length + '件・見込 ' + yen(total)));
  }

  // ---------- 委託 ----------

  function consignPlaces(S) {
    var box = $('placeStat');
    var onSale = 0, sold = 0;
    S.stock.forEach(function (r) { onSale += r.onSale; sold += r.sold; });
    put(box, S.stock.map(function (r) { return statCell(r.place, r.onSale + r.sold); }));
    if (!S.stock.length) put(box, [el('div', null, '—')]);
    put($('placeFoot'), [
      el('span', null, '販売中 ' + onSale),
      el('span', null, '売り切れ ' + sold),
      el('span', null, '合計 ' + (onSale + sold))
    ]);
  }

  /** 委託フィルタのチップ。onPick(value) は app.js から渡す。 */
  function consignFilters(S, current, onPick) {
    var defs = [['all', 'ぜんぶ'], ['販売中', '販売中'], ['売り切れ', '売り切れ']];
    S.stock.forEach(function (r) { defs.push(['place:' + r.place, r.place]); });
    put($('consignFilters'), defs.map(function (d) {
      var b = el('button', 'chipbtn' + (current === d[0] ? ' on' : ''), d[1]);
      b.type = 'button';
      b.onclick = function () { onPick(d[0]); };
      return b;
    }));
  }

  function matchConsign(r, filter) {
    if (filter === 'all') return true;
    if (filter.indexOf('place:') === 0) return r.place === filter.slice(6);
    return r.status === filter;
  }

  /** 委託一覧。onToggle(record, button) / onMore() は app.js から渡す。 */
  function consign(S, filter, limit, onToggle, onMore) {
    var box = $('consignList');
    clear(box);
    var rows = S.lists.consign.filter(function (r) { return matchConsign(r, filter); });
    var view = rows.slice(0, limit);

    if (!view.length) {
      box.appendChild(el('div', 'empty', 'この条件のものは無い'));
    } else {
      view.forEach(function (r) {
        var sold = (r.status === '売り切れ');
        var btn = el('button', 'tag tapme ' + (sold ? 'sold' : 'on'), r.status || '未設定');
        btn.type = 'button';
        btn.onclick = function () { onToggle(r, btn); };
        box.appendChild(actionRow(
          r.name,
          meta([r.place, meta([r.kind, r.size, r.color]), dot(r.date)], '／'),
          [el('span', 'amt', yen(r.price)), btn]
        ));
      });
    }

    // フィルタチップと同じ見た目にすると「もう1つの絞り込み」に見えるので別の形にする
    var more = $('consignMore');
    clear(more);
    if (rows.length > limit) {
      var b = el('button', 'btn ghost', 'もっと見る（残り ' + (rows.length - limit) + ' 点）');
      b.type = 'button';
      b.onclick = onMore;
      more.appendChild(b);
    } else if (rows.length) {
      more.appendChild(el('span', null, rows.length + '点ぜんぶ表示中'));
    }
  }

  // ---------- 報酬 / 固定費 / 経費 ----------

  /** その月の報酬の合計。畳んでいる月の見出しにも出すので、view ではなく全件から数える。 */
  function monthTotal(rows, m) {
    return rows.reduce(function (t, r) { return r.m === m ? t + r.amount : t; }, 0);
  }

  /**
   * 月の見出し。「実績 / 確定分」の呼び分けは DASH（hero・月次推移・年末までの着地）と同じ境目
   * （isFuture）に揃えてある。ここだけ「見込み」などと別の言葉にすると、
   * 同じ数字が画面ごとに違う名前で出てしまう。
   */
  function monthHead(S, m, total) {
    var ahead = isFuture(S, m);
    var h = el('div', 'mhead');
    h.appendChild(el('b', null, (m + 1) + '月'));
    h.appendChild(el('span', 'tag ' + (ahead ? 'sold' : 'q'), ahead ? '確定分' : '実績'));
    h.appendChild(el('span', 'amt', yen(total)));
    return h;
  }

  /**
   * 報酬（フリーランス収入）の一覧。契約が変わったら金額を直す場所なので月ごとにまとめる。
   * 既定で開いて見えるのは from 月から先＝これから変わりうる月だけ。
   * 過ぎた月も編集できるが、直す機会が少ないので onMore の後ろに畳んである。
   */
  function freelance(S, from, onEdit, onMore) {
    // API が報酬を返す前の版でも画面ごと落とさない（描画は1本の render で連なっているので、
    // ここで例外を出すと DASH まで真っ白になる）。デプロイの前後が入れ替わっても耐える。
    var rows = S.lists.freelance || [];
    var box = $('freelanceList');
    var more = $('freelanceMore');
    clear(box);
    clear(more);

    if (!rows.length) {
      box.appendChild(el('div', 'empty', S.year + '年の報酬はまだ登録なし'));
      return;
    }

    var view = rows.filter(function (r) { return r.m >= from; });
    var curM = -1;
    view.forEach(function (r) {
      if (r.m !== curM) {
        curM = r.m;
        box.appendChild(monthHead(S, curM, monthTotal(rows, curM)));
      }
      var b = el('button', 'btn mini', '編集');
      b.type = 'button';
      b.onclick = function () { onEdit(r); };
      // 備考は表示だけ短くする。record 側は元のまま（切った文字列で編集すると尻尾が消える）
      var note = String(r.note || '').replace(/\n/g, ' ').slice(0, 40);
      box.appendChild(actionRow(
        r.kind,
        meta([r.client, r.paid ? '入金 ' + dot(r.paid) : '', note], '／'),
        [el('span', 'amt', yen(r.amount)), b]
      ));
    });

    // 合計は畳んだ月も含めた年ぶん。開いている月だけ足すと、年の姿が畳み方で変わってしまう
    var done = 0, ahead = 0;
    rows.forEach(function (r) {
      if (isFuture(S, r.m)) ahead += r.amount; else done += r.amount;
    });
    var parts = [];
    if (done) parts.push('実績 ' + yen(done));
    if (ahead) parts.push('確定分 ' + yen(ahead));
    box.appendChild(el('div', 'foot', S.year + '年ぶん ' + yen(done + ahead) + '（' + parts.join(' ／ ') + '）'));

    var hidden = rows.length - view.length;
    if (hidden > 0) {
      var mb = el('button', 'btn ghost', '1〜' + from + '月も出す（' + hidden + '件）');
      mb.type = 'button';
      mb.onclick = onMore;
      more.appendChild(mb);
    }
  }

  function fixed(S, onEdit) {
    var box = $('fixedList');
    clear(box);
    if (!S.lists.fixed.length) {
      box.appendChild(el('div', 'empty', 'まだ登録なし（いまの固定費は ¥0）'));
      return;
    }
    var total = 0;
    S.lists.fixed.forEach(function (r) {
      total += r.amount;
      var b = el('button', 'btn mini', '編集');
      b.type = 'button';
      b.onclick = function () { onEdit(r); };
      box.appendChild(actionRow(
        r.name,
        meta([r.category, r.payday || '支払日未設定', r.to ? '〜' + dot(r.to) : ''], '／'),
        [el('span', 'amt neg', '−' + yen(r.amount)), b]
      ));
    });
    box.appendChild(el('div', 'foot', '月額合計 ' + yen(total)));
  }

  var EXPENSE_SHOWN = 150;   // 一覧に出す上限。全件数は見出しに出すので、打ち切ったことを必ず伝える

  function expense(S, onConfirm, onEdit) {
    var rows = S.lists.expense;
    $('expLabel').textContent = yearWord(S) + '経費';
    // 12ヶ月ぶん。1〜今月に絞ると、先の日付の行が一覧には出るのに合計に入らず、見出しと行が合わなくなる。
    // 先の日付は入力側でも塞いである（forms.js の maxToday）が、シートやメール取込からは入りうる。
    // 先の行が無い普段は sumTo(S.expense, thisMonth) と1円も変わらない。
    $('expTotal').textContent = yen(sum(S.expense));
    $('expCount').textContent = rows.length + '件';

    var box = $('expenseList');
    clear(box);
    if (!rows.length) { box.appendChild(el('div', 'empty', 'まだ登録なし')); return; }

    rows.slice(0, EXPENSE_SHOWN).forEach(function (r) {
      var buttons = el('div', 'rbtns');
      if (r.confirmed) {
        buttons.appendChild(el('span', 'tag q', '確定'));
      } else {
        var hot = (r.status === '要確認');
        var b = el('button', 'tag tapme' + (hot ? ' hot' : ''), hot ? '要確認' : '確定する');
        b.type = 'button';
        b.onclick = function () { onConfirm(r, b); };
        buttons.appendChild(b);
      }
      var ed = el('button', 'btn mini', '編集');
      ed.type = 'button';
      ed.onclick = function () { onEdit(r); };
      buttons.appendChild(ed);

      box.appendChild(actionRow(
        r.item || '(内訳なし)',
        meta([r.vendor, meta([r.category, r.method]), dot(r.date), r.source], '／'),
        [el('span', 'amt neg', r.amount ? '−' + yen(r.amount) : '金額未入力'), buttons]
      ));
    });

    if (rows.length > EXPENSE_SHOWN) {
      box.appendChild(el('div', 'foot', '新しい ' + EXPENSE_SHOWN + '件だけ表示中（全 ' + rows.length +
        '件。残りはスプレッドシートで見てね）'));
    }
  }

  // ---------- 通知 ----------

  var toastTimer;
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast'; }, isErr ? 5200 : 2200);
  }

  return {
    hero: hero, forecast: forecast, chart: chart, breakdown: breakdown,
    stock: stock, pipeline: pipeline,
    consignPlaces: consignPlaces, consignFilters: consignFilters, consign: consign,
    freelance: freelance, fixed: fixed, expense: expense, toast: toast
  };
})();
