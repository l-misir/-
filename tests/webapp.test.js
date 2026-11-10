// ホーム画面のWebアプリ（iOS 27、2026-11-11）: 画面を回転して縦に戻すと、ページがステータスバーの高さだけ上にずれ、
// ヘッダーが時計の下に潜った。ステータスバーの下まで常にアプリの画面にし（black-translucent ＋ viewport-fit=cover）、
// 上端の帯はステータスバーの高さ（env(safe-area-inset-top)）だけ下げる。回転でずれが残ったら戻す
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const meta = (app, name) => {
  const el = app.document.querySelector(`meta[name="${name}"]`);
  return el ? el.getAttribute('content') : null;
};
const rule = (css, sel) => {
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${sel.replace(/[.#]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return m ? m[1].replace(/\s+/g, ' ') : '';
};

test('ホーム画面のWebアプリ: ステータスバーの下まで常にアプリの画面（向きで表示領域を変えない）', () => {
  const app = loadApp();
  assert.match(meta(app, 'viewport'), /viewport-fit=cover/);
  assert.equal(meta(app, 'apple-mobile-web-app-status-bar-style'), 'black-translucent');
  assert.equal(meta(app, 'apple-mobile-web-app-capable'), 'yes');
  assert.equal(meta(app, 'mobile-web-app-capable'), 'yes');
});

test('上端の帯（メイン画面のヘッダー・各画面のヘッダー）はステータスバーの高さだけ下げ、本体の高さもその分引く', () => {
  const app = loadApp();
  const css = app.document.querySelector('style').textContent;
  const header = rule(css, '.header');
  assert.match(header, /height:\s*calc\(40px \+ env\(safe-area-inset-top\)\)/, header);
  assert.match(header, /padding-top:\s*calc\(8px \+ env\(safe-area-inset-top\)\)/, header);
  const mh = rule(css, '.modal-header');
  assert.match(mh, /height:\s*calc\(40px \+ env\(safe-area-inset-top\)\)/, mh);
  assert.match(mh, /padding-top:\s*env\(safe-area-inset-top\)/, mh);
  assert.match(rule(css, '.container'), /height:\s*calc\(100dvh - 40px - env\(safe-area-inset-top\)\)/);
});

test('画面を回転したとき、ページがずれていたら戻す（入力中はキーボードのために iOS がずらすので触らない）', () => {
  const app = loadApp();
  const w = app.window;
  const calls = [];
  w.scrollTo = (x, y) => calls.push([x, y]);
  Object.defineProperty(w, 'scrollY', { value: 20, configurable: true });
  w.dispatchEvent(new w.Event('orientationchange'));
  assert.deepEqual(calls[0], [0, 0]);

  calls.length = 0;
  const input = app.document.getElementById('gas-url');
  input.focus();
  assert.equal(app.document.activeElement, input);
  w.dispatchEvent(new w.Event('orientationchange'));
  assert.equal(calls.length, 0, '入力中は触らない');

  input.blur();
  Object.defineProperty(w, 'scrollY', { value: 0, configurable: true });
  w.dispatchEvent(new w.Event('orientationchange'));
  assert.equal(calls.length, 0, 'ずれていなければ何もしない');
});
