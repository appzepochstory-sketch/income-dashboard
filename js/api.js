/**
 * api.js — GAS JSON API との通信だけを持つ層。DOM には一切触らない。
 * 画面（views.js / app.js）を差し替えてもここは動く。
 *
 * 認証: 合言葉そのものは送らない。ブラウザで token = sha256(合言葉) を作って送り、
 *       サーバは sha256(token) を保存値と比較する。localStorage に残るのも token だけ。
 * 通信: GAS は任意のレスポンスヘッダを付けられないので、プリフライトが飛ばない
 *       Content-Type: text/plain の POST（simple request）1本に統一する。
 *       GET+JSONP は使わない（token が URL に載って履歴やログに残るため）。
 */
window.IncApi = (function () {
  'use strict';

  var TOKEN_KEY = 'inc_api_token';
  var cfg = window.INC_CONFIG;

  function endpoint() {
    if (!cfg.endpoint || cfg.endpoint.indexOf('http') !== 0) {
      throw new Error('APIのURLが未設定です（js/config.js の endpoint）');
    }
    return cfg.endpoint;
  }

  function toHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  /** 合言葉 → token。WebCrypto は https でのみ使える（GitHub Pages は https）。 */
  function makeToken(passphrase) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error('この環境では暗号化APIが使えません（https で開いてください）'));
    }
    var bytes = new TextEncoder().encode(String(passphrase));
    return window.crypto.subtle.digest('SHA-256', bytes).then(toHex);
  }

  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function hasToken() { return !!token(); }
  function forget() { localStorage.removeItem(TOKEN_KEY); }

  /** 合言葉を検証してから保存する（間違っていれば保存しない）。 */
  function signIn(passphrase) {
    return makeToken(passphrase).then(function (t) {
      return send('bootstrap', {}, t).then(function (data) {
        localStorage.setItem(TOKEN_KEY, t);
        return data;
      });
    });
  }

  function send(action, payload, overrideToken) {
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, cfg.timeoutMs);

    return fetch(endpoint(), {
      method: 'POST',
      // text/plain にしないとプリフライト（OPTIONS）が飛び、GAS は OPTIONS に応答できない
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: overrideToken || token(), action: action, payload: payload || {} }),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('APIエラー HTTP ' + res.status);
      return res.text();
    }).then(function (text) {
      var json;
      try { json = JSON.parse(text); }
      catch (e) { throw new Error('APIの応答を解釈できません: ' + text.slice(0, 120)); }
      if (!json.ok) throw new Error(json.error || '不明なエラー');
      return json.data;
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw new Error('APIがタイムアウトしました');
      throw err;
    }).then(function (v) {
      clearTimeout(timer);
      return v;
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  /** 認証済み前提の呼び出し。token が無ければ通信せずに失敗させる。 */
  function call(action, payload) {
    if (!hasToken()) return Promise.reject(new Error('合言葉が未入力です'));
    return send(action, payload);
  }

  return {
    signIn: signIn,
    hasToken: hasToken,
    forget: forget,
    call: call,
    bootstrap: function (year) { return call('bootstrap', { year: year || '' }); }
  };
})();
