// テスト共通: index.html を jsdom で読み込み、グローバル関数を呼べる状態にする
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

function loadApp() {
  // 外部CDN(html2canvas)はテストでは不要なので除去
  const html = fs
    .readFileSync(HTML_PATH, 'utf-8')
    .replace(/<script src="https:\/\/html2canvas[^"]*"><\/script>/, '');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/', // localStorage を有効にするため
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
  if (typeof window.onload === 'function') window.onload();

  // let/const で宣言されたトップレベル変数は window のプロパティにならないため eval 経由で扱う
  const ev = (code) => window.eval(code);

  const selectMachine = (m) => {
    window.document.getElementById('machine-select').value = m;
    window.updateMachine();
  };

  return { dom, window, document: window.document, ev, errors, selectMachine };
}

// HTML から <script> 本体だけを抜き出す（構文チェック用）
function extractScript() {
  const src = fs.readFileSync(HTML_PATH, 'utf-8');
  const m = src.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('inline <script> not found');
  return m[1];
}

module.exports = { loadApp, extractScript, HTML_PATH };
