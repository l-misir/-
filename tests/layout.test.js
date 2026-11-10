// メイン画面のボタンの高さ（2026-11-11）: 縦横同じで、縦画面にちょうど入る一番大きい高さ。ヘッダーも同じ高さ。
// 高さは決まった数にせず、縦画面の高さ・ステータスバー・見出しの高さから計算する（fitButtonHeight。下にボタンを足しても計算し直すだけ）
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

test('ボタンの高さの計算: 縦画面の高さから、ボタン8段＋ヘッダー1つがちょうど入る高さ（端数は切り捨て、30〜64px）', () => {
  const app = loadApp();
  const h = (o) => app.ev(`buttonHeightFor(${JSON.stringify(o)})`);
  // iPhone SE（縦 667pt、ステータスバー 20pt）、余白 上5・下12・左右の列の間5、見出しなど1段あたり28px
  const se = { portraitH: 667, insetTop: 20, padTop: 5, padBottom: 12, gap: 5, rows: 8, nonCellPerRow: 28 };
  assert.equal(h(se), 44, '(667 − 20 − 5 − 12 − 5 − 8×28) ÷ 9 = 44.5');
  assert.equal(h({ ...se, portraitH: 844, insetTop: 47 }), 61, 'ノッチのある iPhone は大きく');
  assert.equal(h({ ...se, portraitH: 400 }), 30, '小さすぎるときは 30');
  assert.equal(h({ ...se, portraitH: 1200 }), 64, '大きすぎるときは 64');
  assert.equal(h({ ...se, rows: 9 }), 37, '下に1段足すとその分低く');
});

test('ボタン・ヘッダー・各画面の上の帯は同じ高さ（--btn-h）。カウントロックの画面のボタンも同じ', () => {
  const app = loadApp();
  const css = app.document.querySelector('style').textContent;
  assert.match(css, /--btn-h:\s*44px/, '計算する前（と、測れないとき）の高さ');
  assert.match(css, /#main-ui \.cell, #lock-body \.cell\s*\{[^}]*height:\s*var\(--btn-h\)/);
  assert.equal(app.errors.length, 0);
  app.ev('fitButtonHeight()'); // jsdom は大きさを測れない。そのときは何もしない
  assert.equal(app.document.documentElement.style.getPropertyValue('--btn-h'), '');
});

test('機種名は左右のアイコンの間いっぱい（帯の高さいっぱい）を押せる。下線は名前の所だけ', () => {
  const app = loadApp();
  const css = app.document.querySelector('style').textContent;
  assert.match(css, /#disp-machine\s*\{[^}]*flex:\s*1 1 auto[^}]*\}/);
  assert.match(css, /\.header > \.header-icon\s*\{[^}]*width:\s*56px[^}]*margin:\s*0[^}]*\}/, 'アイコンの押せる範囲は機種名と重ならない');
  assert.match(css, /#disp-machine:not\(\.with-dots\) > #disp-machine-name\s*\{[^}]*border-bottom:\s*2px solid white/);
  app.window.document.getElementById('machine-select').value = 'king';
  app.window.updateMachine();
  assert.equal(app.document.getElementById('disp-machine-name').textContent, 'キングハナハナ');
});

// 縦画面で計算した高さを横画面でもそのまま使う（ノッチのある iPhone は下の余白が縦横で違い、横画面で計算し直すと高さが変わった。Codex 指摘）
test('回転しても高さは変わらない（縦画面で計算した高さを横画面でも使う）', () => {
  const app = loadApp();
  const w = app.window, doc = app.document;
  const env = { inset: 47, padBottom: 34 }; // iPhone（ノッチあり）の縦画面
  const btnH = () => parseFloat(doc.documentElement.style.getPropertyValue('--btn-h')) || 44;
  // 大きさを測れない jsdom の代わりに、左の列（見出し付きのボタン4段、見出しなど1段 28px）と余白を返す
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: this.classList.contains('col-left') ? 4 * (btnH() + 28) : 0 };
  };
  const real = w.getComputedStyle.bind(w);
  w.getComputedStyle = (el, p) => {
    if (el.classList && el.classList.contains('container')) return { paddingTop: '5px', paddingBottom: env.padBottom + 'px' };
    if (el.classList && el.classList.contains('header')) return { paddingTop: env.inset + 'px' };
    return real(el, p);
  };
  const size = (wd, ht) => {
    Object.defineProperty(w, 'innerWidth', { value: wd, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: ht, configurable: true });
  };
  size(390, 844);
  app.ev('fitButtonHeight()');
  assert.equal(btnH(), 58, '(844 − 47 − 5 − 34 − 5 − 8×28) ÷ 9');
  size(844, 390); Object.assign(env, { inset: 0, padBottom: 21 }); // 横画面
  app.ev('fitButtonHeight()');
  assert.equal(btnH(), 58, '横画面でも同じ高さ');
  size(390, 844); Object.assign(env, { inset: 47, padBottom: 34 });
  app.ev('fitButtonHeight()');
  assert.equal(btnH(), 58);
});
