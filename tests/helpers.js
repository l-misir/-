// テスト共通: index.html を jsdom で読み込み、グローバル関数を呼べる状態にする
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

// storage: 起動前に localStorage('hana_v20_data') へ入れておく保存データ（再起動時の挙動を見るとき用）
// query: URL のクエリ（例 '?bell=135&t=20260927153012'。ショートカットからの起動を再現）
// setup(window): スクリプト実行前に呼ぶ（localStorage を壊す等）
// beforeStartup(window): スクリプト実行後・起動処理(onload)の前に呼ぶ（起動前のイベント等）
function loadApp({ storage, query = '', setup, beforeStartup } = {}) {
  // 外部CDN(html2canvas)はテストでは不要なので除去
  const html = fs
    .readFileSync(HTML_PATH, 'utf-8')
    .replace(/<script src="https:\/\/html2canvas[^"]*"><\/script>/, '');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/index.html' + query, // localStorage を有効にするため
    beforeParse(window) {
      if (storage) window.localStorage.setItem('hana_v20_data', JSON.stringify(storage));
      // jsdom に無い Pointer Capture をスタブ化（メイン画面のタップ処理が呼ぶ）
      window.Element.prototype.setPointerCapture = () => {};
      window.Element.prototype.releasePointerCapture = () => {};
      if (setup) setup(window);
    },
  });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.message));

  // ネットワーク・ダイアログはスタブ化
  window.fetch = () =>
    Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) });
  window.alert = () => {};
  window.confirm = () => true;

  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  if (beforeStartup) beforeStartup(window);
  // 起動処理はここで1回だけ呼ぶ。jsdom が後から発火する load で二重に走らないよう外しておく
  const onload = window.onload;
  window.onload = null;
  if (typeof onload === 'function') onload();

  // let/const で宣言されたトップレベル変数は window のプロパティにならないため eval 経由で扱う
  const ev = (code) => window.eval(code);

  const selectMachine = (m) => {
    window.document.getElementById('machine-select').value = m;
    window.updateMachine();
  };

  // メイン画面のセルをタップ（long=true で長押し＝マイナス）。selector 例: '[data-id="g"]'
  const tap = async (selector, { long = false } = {}) => {
    const el = window.document.querySelector(selector);
    if (!el) throw new Error(`not found: ${selector}`);
    // jsdom は onpointerdown 等のプロパティ代入をイベントとして扱わないため、ハンドラを直接呼ぶ
    const fire = (type) => {
      const e = new window.Event(type, { bubbles: true });
      e.pointerId = 1;
      window.document.dispatchEvent(e); // document 側のリスナー（テンキー外タップで閉じる等）
      el['on' + type](e);
    };
    fire('pointerdown');
    if (long) await new Promise((r) => setTimeout(r, 350)); // 300ms で赤（マイナス）
    fire('pointerup');
  };

  return { dom, window, document: window.document, ev, errors, selectMachine, tap };
}

// HTML から <script> 本体だけを抜き出す（構文チェック用）
function extractScript() {
  const src = fs.readFileSync(HTML_PATH, 'utf-8');
  const m = src.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('inline <script> not found');
  return m[1];
}

// アプリのタイマー（setTimeout / clearTimeout）と Date.now を手で進める時計に差し替える。戻り値の advance(ms) で時間を進める。
// 本物の時間を待つテストは、テストを並列で走らせて重いと遅れたり、Node 24 + jsdom ではページ側のタイマーが
// しばらく動かないことがあった（2026-10-06）ので、時間で動きが変わるところはこれで確かめる
function useManualTimers(app) {
  let now = 0, seq = 0;
  const timers = new Map();
  const base = app.window.Date.now();
  app.window.Date.now = () => base + now; // アプリが測る時間（押していた時間など）も同じ時計で進める
  app.window.setTimeout = (fn, ms = 0, ...args) => { timers.set(++seq, { fn, args, at: now + (Number(ms) || 0) }); return seq; };
  app.window.clearTimeout = (id) => { timers.delete(id); };
  return function advance(ms) {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
      if (due.length === 0) break;
      const [id, t] = due[0];
      timers.delete(id);
      now = t.at;
      t.fn(...t.args);
    }
    now = end;
  };
}

// シート1行（GAS が返す values と同じ形）を見出し → 値で組み立てる。列の並びは sheetColumns(m) から取る（A 列はメモ）。
// detail を渡すと詳細記録の列（記録した日）も埋める。書かなかった列は空欄
let columnsApp = null;
function sheetRow(m, vals = {}, detail = null) {
  if (!columnsApp) columnsApp = loadApp();
  const cols = JSON.parse(columnsApp.ev(`JSON.stringify(sheetColumns('${m}'))`));
  return cols.map((c) => {
    if (c.h in vals) return vals[c.h];
    if (detail && c.t === 'detail') return detail[c.k] || 0;
    return '';
  });
}

module.exports = { loadApp, extractScript, HTML_PATH, useManualTimers, sheetRow };
