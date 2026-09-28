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

module.exports = { loadApp, extractScript, HTML_PATH };
