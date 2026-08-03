/**
 * forms.js — 入力フォームの定義と組み立て・値の取り出し・リセット。
 * 通信も画面遷移も知らない。DOM API で組むので、シート由来の選択肢がそのまま HTML に化けることはない。
 *
 * フォーム項目 → スプレッドシート列の対応（src/Write.gs と揃えてある）:
 *   illust : ordered=依頼日 / delivered=納品日 / kind=種類 / client=クライアント種別 / price=価格 / note=備考
 *   sale   : date=販売日 / place=販売場所 / name=商品名 / kind=種類 / color=カラー / size=サイズ / price=価格 / note=備考
 *   consign: date=委託日 / place=委託先 / name=商品名 / kind=種類 / color=カラー / size=サイズ / price=価格 / note=備考
 *   fixed  : name=項目 / amount=金額 / payday=支払日 / category=カテゴリ / from=開始月 / to=終了月 / note=メモ
 *   expense: date=日付 / item=内訳 / vendor=取引先 / amount=金額 / category=カテゴリ / method=支払方法
 *            ／ confirmed=確定フラグ（経費タブに「メモ」列は無い）
 *
 * 項目の引き当てに form.elements[name] は使わない。'item' のように
 * HTMLFormControlsCollection のメソッド名と衝突する名前があり、入力欄ではなく関数が返るため。
 */
window.IncForms = (function () {
  'use strict';

  var NEW_VALUE = '__new';
  var NEW_SUFFIX = NEW_VALUE;   // 自由入力欄の name は「元の name + この接尾辞」。同じ文字列に依存しているので束ねる

  /**
   * 選択肢の opts は API の bootstrap.options のキー。
   * 画面側に直接持つのは、シートに元データが無い「販売場所」だけ（list で指定）。
   */
  var DEFS = {
    illust: {
      title: 'イラスト案件', sub: '依頼を受けたら先に入れておく', btn: '案件を追加',
      action: 'addIllust', okMsg: 'イラスト案件を追加したよ',
      fields: [
        { n: 'ordered', l: '依頼日', t: 'date', req: true, today: true },
        { n: 'delivered', l: '納品日', t: 'date', hint: '空欄のままなら進行中の扱い' },
        { n: 'kind', l: '種類', t: 'select', opts: 'illustKinds' },
        { n: 'client', l: 'クライアント種別', t: 'select', opts: 'clientTypes' },
        { n: 'price', l: '価格', t: 'yen', req: true },
        { n: 'note', l: '備考', t: 'area', hint: 'クライアント名などはここ' }
      ]
    },
    sale: {
      title: 'Epochstory販売', sub: '対面で売れた分だけ手入力（ECは自動）', btn: '販売を追加',
      action: 'addSale', okMsg: 'Epochstory販売に追加したよ',
      fields: [
        { n: 'date', l: '販売日', t: 'date', req: true, today: true },
        // 空で送るとサーバが '直接' を補う。画面と食い違わないよう最初から選んでおく
        { n: 'place', l: '販売場所', t: 'select', list: ['直接', 'EC', 'イベント'], preset: '直接' },
        { n: 'name', l: '商品名', t: 'text', req: true, datalist: 'dlSquareItems', hintId: 'sqHintSale' },
        { n: 'kind', l: '種類', t: 'select', opts: 'consignKinds' },
        { n: 'color', l: 'カラー', t: 'text', ph: '例：Black', half: true },
        { n: 'size', l: 'サイズ', t: 'select', opts: 'sizes', half: true },
        { n: 'price', l: '価格', t: 'yen', req: true },
        { n: 'note', l: '備考', t: 'text' }
      ]
    },
    consign: {
      title: '新しく委託する', sub: '', btn: '委託に出す',
      action: 'addConsign', okMsg: '委託商品を追加したよ',
      fields: [
        { n: 'date', l: '委託日', t: 'date', req: true, today: true },
        { n: 'place', l: '委託先', t: 'select', req: true, opts: 'consignPlaces', add: '委託先の名前' },
        { n: 'name', l: '商品名', t: 'text', req: true, datalist: 'dlSquareItems', hintId: 'sqHint' },
        { n: 'kind', l: '種類', t: 'select', opts: 'consignKinds', add: '種類の名前' },
        { n: 'color', l: 'カラー', t: 'text', ph: '例：Black', half: true },
        { n: 'size', l: 'サイズ', t: 'select', opts: 'sizes', half: true },
        { n: 'price', l: '価格', t: 'yen', req: true },
        { n: 'note', l: '備考', t: 'text' }
      ]
    },
    fixed: {
      title: '固定費を追加', editTitle: '固定費を編集', sub: '', btn: '保存する',
      action: 'saveFixed', okMsg: '固定費を保存したよ', editable: true,
      hidden: ['row', 'expected'],
      fields: [
        { n: 'name', l: '項目', t: 'text', req: true, ph: 'Adobe CC' },
        { n: 'amount', l: '金額（月額）', t: 'yen', req: true },
        { n: 'payday', l: '支払日', t: 'text', ph: '毎月27日' },
        { n: 'category', l: 'カテゴリ', t: 'select', opts: 'fixedCategories' },
        { n: 'from', l: '開始月', t: 'date', half: true, hint: 'その月の1日で' },
        { n: 'to', l: '終了月', t: 'date', half: true, hint: '空欄＝継続中' },
        { n: 'note', l: 'メモ', t: 'area' }
      ]
    },
    expense: {
      title: '経費を手で足す', editTitle: '経費を編集', sub: '', btn: '保存する',
      action: 'saveExpense', okMsg: '経費を保存したよ', editable: true,
      hidden: ['row', 'expected', 'ref', 'source', 'status'],
      fields: [
        { n: 'date', l: '日付', t: 'date', req: true, today: true },
        { n: 'item', l: '内訳', t: 'text', ph: 'ステッカー印刷' },
        { n: 'vendor', l: '取引先', t: 'text', ph: 'OHPRINT.ME' },
        { n: 'amount', l: '金額', t: 'yen' },
        { n: 'category', l: 'カテゴリ', t: 'select', opts: 'expenseCategories' },
        { n: 'method', l: '支払方法', t: 'select', opts: 'payMethods' },
        { n: 'confirmed', l: '確定にする', t: 'check' }
      ]
    }
  };

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  /** name で入力欄を引く。form.elements の名前つきアクセスは使わない（上のコメント参照）。 */
  function field(form, name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /**
   * 入力欄に値を入れる。
   *
   * ⚠️ select に「選択肢に無い値」を代入すると value は黙って '' に落ちる。
   *    シートに手入力された古いカテゴリなどがそれに当たり、そのまま保存すると
   *    こちらが空文字で上書きしてセルを消してしまう。無ければ選択肢の方を足す。
   */
  function setValue(input, v) {
    var val = (v == null) ? '' : String(v);
    if (input.tagName === 'SELECT' && val && val !== NEW_VALUE) {
      var known = Array.prototype.some.call(input.options, function (o) { return o.value === val; });
      if (!known) {
        var tail = input.options[input.options.length - 1];
        var extra = new Option(val, val);
        // 「＋ 新しく追加する…」は必ず末尾に残す
        if (tail && tail.value === NEW_VALUE) input.insertBefore(extra, tail);
        else input.appendChild(extra);
      }
    }
    input.value = val;
  }

  /** select の中身を入れ替える。いま選ばれている値は消さない（再描画で入力が飛ばないように）。 */
  function fillSelect(sel, values, addLabel) {
    var keep = sel.value;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    // 空ラベルだと「未入力」なのか「壊れている」のか見分けがつかないので文言を入れる
    sel.appendChild(new Option('選んでね', ''));
    (values || []).forEach(function (v) { sel.appendChild(new Option(v, v)); });
    if (addLabel) sel.appendChild(new Option('＋ 新しく追加する…', NEW_VALUE));
    if (keep) setValue(sel, keep);   // 選択肢が縮んでも、選んでいた値を '' に落とさない
  }

  function buildCheck(f) {
    var wrap = el('label', 'chk');
    var box = el('input');
    box.type = 'checkbox';
    box.name = f.n;
    wrap.appendChild(box);
    wrap.appendChild(document.createTextNode(f.l));
    return wrap;
  }

  /** 入力欄の本体（wrap があればそれ、無ければ control 自身を返す）。 */
  function buildControl(f, options) {
    if (f.t === 'date') {
      var dw = el('div', 'datewrap');
      var d = el('input');
      d.type = 'date';
      d.name = f.n;
      if (f.today) d.value = today();
      dw.appendChild(d);
      return { wrap: dw, control: d };
    }
    if (f.t === 'select') {
      var sw = el('div', 'selwrap');
      var sel = el('select');
      sel.name = f.n;
      fillSelect(sel, f.list || (options[f.opts] || []), f.add);
      if (f.preset) {
        setValue(sel, f.preset);
        // defaultSelected にしておくと form.reset() でもこの値に戻る
        if (sel.selectedIndex >= 0) sel.options[sel.selectedIndex].defaultSelected = true;
      }
      sw.appendChild(sel);
      return { wrap: sw, control: sel };
    }
    if (f.t === 'area') {
      var ta = el('textarea');
      ta.name = f.n;
      ta.rows = 2;
      return { wrap: ta, control: ta };
    }
    var input = el('input');
    input.name = f.n;
    if (f.t === 'yen') {
      input.type = 'number';
      input.inputMode = 'numeric';
      input.placeholder = '0';
    } else {
      input.type = 'text';
      if (f.ph) input.placeholder = f.ph;
      if (f.datalist) input.setAttribute('list', f.datalist);
    }
    return { wrap: input, control: input };
  }

  function buildField(f, options) {
    if (f.t === 'check') return buildCheck(f);

    var label = el('label', 'fld');
    var head = el('span');
    head.appendChild(document.createTextNode(f.l));
    if (f.req) {
      var em = el('em');
      em.textContent = '必須';
      head.appendChild(em);
    }
    label.appendChild(head);

    var built = buildControl(f, options);
    if (f.req) built.control.required = true;
    label.appendChild(built.wrap);

    if (f.add) {
      var newin = el('input', 'newin');
      newin.type = 'text';
      newin.name = f.n + NEW_SUFFIX;
      newin.placeholder = f.add + 'を入力';
      newin.hidden = true;
      label.appendChild(newin);
    }
    if (f.hint) {
      var hint = el('small');
      hint.textContent = f.hint;
      label.appendChild(hint);
    }
    if (f.hintId) {
      var slot = el('small');
      slot.id = f.hintId;
      label.appendChild(slot);
    }
    return label;
  }

  /**
   * フォームを1つ組み立てて DocumentFragment で返す。
   * opts.bare=true で見出しを出さない（ボトムシートは自前の見出しを持つため）。
   */
  function build(key, options, opts) {
    opts = opts || {};
    var D = DEFS[key];
    var box = document.createDocumentFragment();

    if (!opts.bare) {
      var lbl = el('div', 'lbl' + (opts.tilt ? ' tilt2' : ''));
      lbl.textContent = D.title;
      lbl.dataset.formTitle = key;
      box.appendChild(lbl);
      if (D.sub) {
        var sub = el('span', 'lbl-sub');
        sub.textContent = D.sub;
        box.appendChild(sub);
      }
    }

    var form = el('form');
    form.dataset.form = key;
    form.noValidate = true;   // 必須チェックは自前で出す（hidden な項目で focus 例外が出るため）

    (D.hidden || []).forEach(function (name) {
      var h = el('input');
      h.type = 'hidden';
      h.name = name;
      form.appendChild(h);
    });

    var fs = D.fields;
    for (var i = 0; i < fs.length; i++) {
      if (fs[i].half && fs[i + 1] && fs[i + 1].half) {
        var pair = el('div', 'half');
        pair.appendChild(buildField(fs[i], options));
        pair.appendChild(buildField(fs[i + 1], options));
        form.appendChild(pair);
        i++;
      } else {
        form.appendChild(buildField(fs[i], options));
      }
    }

    var submit = el('button', 'btn' + (opts.lime ? ' lime' : ''));
    submit.type = 'submit';
    submit.textContent = D.btn;
    if (D.editable) {
      var actions = el('div', 'row2');
      var cancel = el('button', 'btn ghost mini');
      cancel.type = 'button';
      cancel.dataset.reset = '1';
      cancel.textContent = '新規に戻す';
      actions.appendChild(submit);
      actions.appendChild(cancel);
      form.appendChild(actions);
    } else {
      form.appendChild(submit);
    }

    box.appendChild(form);
    return box;
  }

  /** 再描画のたびに選択肢だけ入れ直す（入力途中の値は保つ）。 */
  function refreshOptions(root, options) {
    root.querySelectorAll('form[data-form]').forEach(function (form) {
      var D = DEFS[form.dataset.form];
      if (!D) return;
      D.fields.forEach(function (f) {
        if (f.t !== 'select' || f.list) return;
        var sel = field(form, f.n);
        if (sel) fillSelect(sel, options[f.opts] || [], f.add);
      });
    });
  }

  /** 「＋ 新しく追加する…」の自由入力欄の出し入れ／日付欄はどこを押してもピッカーを開く。 */
  function wire(root) {
    root.querySelectorAll('input[type=date]').forEach(function (input) {
      if (input.dataset.w) return;
      input.dataset.w = '1';
      // click だけにする（focus も足すと 閉→再フォーカス→再オープン のループになる）
      input.addEventListener('click', function () {
        try { if (input.showPicker) input.showPicker(); } catch (e) { /* 未対応環境では既定動作にまかせる */ }
      });
    });
    root.querySelectorAll('select').forEach(function (sel) {
      if (sel.dataset.w) return;
      sel.dataset.w = '1';
      sel.addEventListener('change', function () {
        var fld = sel.closest('.fld');
        var extra = fld && fld.querySelector('.newin');
        if (!extra) return;
        extra.hidden = (sel.value !== NEW_VALUE);
        if (!extra.hidden) extra.focus();
      });
    });
  }

  /** 送信する値。「＋ 新しく追加する…」は隣の自由入力欄の値に置き換える。 */
  function values(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (e) {
      if (!e.name || e.name.slice(-NEW_SUFFIX.length) === NEW_SUFFIX) return;
      if (e.type === 'checkbox') { out[e.name] = e.checked; return; }
      if (e.value === NEW_VALUE) {
        var extra = field(form, e.name + NEW_SUFFIX);
        out[e.name] = extra ? extra.value.trim() : '';
        return;
      }
      out[e.name] = e.value;
    });
    return out;
  }

  /**
   * 足りない入力を1つ返す（無ければ null）。
   * 「＋ 新しく追加する…」を選んだまま名前が空なら、必須でなくても足りない扱い。
   */
  function missing(form) {
    var found = null;
    DEFS[form.dataset.form].fields.some(function (f) {
      var input = field(form, f.n);
      if (!input) return false;
      if (input.value === NEW_VALUE) {
        var extra = field(form, f.n + NEW_SUFFIX);
        if (!extra || !extra.value.trim()) { found = { label: f.l, input: extra || input }; return true; }
        return false;
      }
      if (f.req && !String(input.value).trim()) { found = { label: f.l, input: input }; return true; }
      return false;
    });
    return found;
  }

  /**
   * フォームを新規入力の状態に戻す。
   *
   * ⚠️ type="hidden" の value は content 属性そのもので、form.reset() では戻らない。
   *    ここで明示的に空にしないと、編集で掴んだ row / expected が残り続け、
   *    次の「追加」がその行を上書きしてしまう（2026-08-03 修正）。
   */
  function reset(form) {
    var D = DEFS[form.dataset.form];
    form.reset();
    form.querySelectorAll('input[type=hidden]').forEach(function (h) { h.value = ''; });
    form.querySelectorAll('.newin').forEach(function (n) { n.value = ''; n.hidden = true; });
    // 日付の初期値（今日）も reset() では戻らないので入れ直す
    D.fields.forEach(function (f) {
      if (f.t !== 'date' || !f.today) return;
      var input = field(form, f.n);
      if (input) input.value = today();
    });
    setTitle(form, D.title);
  }

  /** 既存行を編集する状態にする。record のキーは bootstrap の lists がそのまま。 */
  function fill(form, record) {
    var D = DEFS[form.dataset.form];
    (D.hidden || []).forEach(function (name) {
      var v = (name === 'expected') ? record.print : record[name];
      setValue(field(form, name), v);
    });
    D.fields.forEach(function (f) {
      var input = field(form, f.n);
      if (!input) return;
      if (f.t === 'check') { input.checked = !!record[f.n]; return; }
      setValue(input, record[f.n]);
    });
    setTitle(form, D.editTitle + (record.name ? '（' + record.name + '）' : ''));
  }

  function setTitle(form, text) {
    var lbl = form.parentNode && form.parentNode.querySelector('[data-form-title]');
    if (lbl) lbl.textContent = text;
  }

  return {
    defs: DEFS,
    build: build,
    wire: wire,
    refreshOptions: refreshOptions,
    values: values,
    missing: missing,
    reset: reset,
    fill: fill
  };
})();
