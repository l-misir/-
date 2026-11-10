// 横画面の時計の帯（2026-11-11 ユーザー要望）: iPhone は横画面でステータスバー（時計）を出さないので、自前で出す。
// 左に日付・曜日、真ん中に時刻（24時間・秒まで）、右に通信が切れたときだけ「圏外」。電池・電波は Safari から分からないので出さない。
// 帯の分（--strip-h、横画面だけ 20px）ヘッダーを下げ、ヘッダーを画面の上の端（通知センターを出す場所）から離す
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

test('帯の文字: 日付・曜日 / 時刻（24時間・秒まで）/ 通信が切れたときだけ「圏外」', () => {
  const app = loadApp();
  const t = (y, mo, d, h, mi, s, online) => JSON.parse(app.ev(`JSON.stringify(clockBarText(new Date(${y}, ${mo - 1}, ${d}, ${h}, ${mi}, ${s}), ${online}))`));
  assert.deepEqual(t(2026, 11, 11, 15, 42, 8, true), { date: '11/11(水)', time: '15:42:08', net: '' });
  assert.deepEqual(t(2026, 1, 4, 9, 5, 3, true), { date: '1/4(日)', time: '9:05:03', net: '' }, '時は0を付けない（iPhone と同じ）');
  assert.deepEqual(t(2026, 11, 14, 0, 0, 0, false), { date: '11/14(土)', time: '0:00:00', net: '圏外' });
});

test('帯は画面の一番上に固定し、横画面だけ出す（高さ 20px）。押しても何も起きない', () => {
  const app = loadApp();
  const doc = app.document;
  const bar = doc.getElementById('clock-bar');
  assert.ok(bar);
  assert.deepEqual([...bar.children].map((e) => e.id), ['clock-date', 'clock-time', 'clock-net']);
  assert.match(doc.getElementById('clock-time').textContent, /^\d{1,2}:\d{2}:\d{2}$/, '読み込んだときに書く');
  const css = doc.querySelector('style').textContent;
  assert.match(css, /--strip-h:\s*0px/, '縦画面は帯なし');
  assert.match(css, /@media \(orientation: landscape\)\s*\{\s*:root\s*\{\s*--strip-h:\s*20px;\s*\}/, '横画面は 20px');
  assert.match(css, /#clock-bar\s*\{[^}]*position:\s*fixed[^}]*top:\s*0[^}]*height:\s*var\(--strip-h\)[^}]*pointer-events:\s*none/);
  assert.equal(bar.querySelector('.haptic-tap'), null, '押せるものではない（振動用ラベルなし）');
});

test('ヘッダー・各画面の上の帯・本体の高さは、時計の帯の分も入れる', () => {
  const app = loadApp();
  const css = app.document.querySelector('style').textContent;
  const rule = (sel) => (css.match(new RegExp(`(?:^|\\n)\\s*${sel.replace(/[.#]/g, '\\$&')}\\s*\\{([^}]*)\\}`)) || [])[1] || '';
  assert.match(rule('.header'), /padding:\s*calc\(env\(safe-area-inset-top\) \+ var\(--strip-h\)\)/);
  assert.match(rule('.header'), /height:\s*calc\(var\(--btn-h\) \+ env\(safe-area-inset-top\) \+ var\(--strip-h\)\)/);
  assert.match(rule('.modal-header'), /padding-top:\s*calc\(env\(safe-area-inset-top\) \+ var\(--strip-h\)\)/);
  assert.match(rule('.modal-header'), /height:\s*calc\(var\(--btn-h\) \+ env\(safe-area-inset-top\) \+ var\(--strip-h\)\)/);
  assert.match(rule('.container'), /height:\s*calc\(100dvh - var\(--btn-h\) - env\(safe-area-inset-top\) - var\(--strip-h\)\)/);
});

test('1秒ごとの書き換えは横画面で画面が出ている間だけ（縦画面では止める）', () => {
  let mq = null;
  const app = loadApp({
    setup(w) {
      w.matchMedia = (q) => (mq = { media: q, matches: false, listeners: [], addEventListener(_, f) { this.listeners.push(f); } });
    },
  });
  const timers = () => app.ev('clockTimer');
  assert.equal(mq.media, '(orientation: landscape)');
  assert.equal(timers(), null, '縦画面は止めておく');
  mq.matches = true;
  mq.listeners.forEach((f) => f());
  assert.notEqual(timers(), null, '横画面になったら動かす');
  mq.matches = false;
  mq.listeners.forEach((f) => f());
  app.window.close();
});
