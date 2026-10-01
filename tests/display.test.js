// 表示の調整（2026-10）: 小役・欠損のダミー表示は5桁にそろえる、ダミー中も機種名は薄くしない、
// カウントロックの画面はメイン画面と同じボタン（大きさ・表示）で説明文なし、設定画面のボタンの間隔をそろえる
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const shown = (app, sel) => app.document.querySelector(`#main-ui ${sel} .value`).textContent;

test('ダミー表示: ベル・スイカ（小役）は値の桁数に関係なく5桁。本当の数を真ん中あたりに入れる', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('const d = getData(); d.cur.bell = 7; d.cur.suika = 31; d.cur.suikaR = 400; d.cur.retro = 2; d.lamps.big[0] = 3;');
  app.window.setDummyDefault(true);
  const bell = shown(app, '[data-id="bell"]');
  assert.equal(bell.length, 5);
  assert.equal(bell.slice(2, 3), '7', '1桁: 前2桁・後2桁');
  const sui = shown(app, '[data-id="suika"]');
  assert.equal(sui.length, 5);
  assert.equal(sui.slice(2, 4), '31', '2桁: 前2桁・後1桁');
  const suiR = shown(app, '[data-id="suikaR"]');
  assert.equal(suiR.length, 5);
  assert.equal(suiR.slice(1, 4), '400', '3桁: 前1桁・後1桁');
  assert.notEqual(bell[0], '0', '先頭は0にしない');
  app.ev('getData().cur.bell = 1234; renderMain();');
  assert.equal(shown(app, '[data-id="bell"]').slice(1), '1234', '4桁: 前1桁');
  app.ev('getData().cur.bell = 12345; renderMain();');
  assert.equal(shown(app, '[data-id="bell"]'), '12345', '5桁以上はそのまま');
  assert.equal(shown(app, '[data-id="retro"]').length, 5, 'レトロは今までどおり前後2桁（2 → 5桁）');
  assert.equal(shown(app, '.t-lamp[data-type="big"][data-idx="0"]').length, 3, 'ランプは今までどおり前後1桁');
  assert.equal(app.ev('getData().cur.bell'), 12345, '内部値は変えない');
});

test('ダミー表示（詳細記録）: 小役・欠損・取得の欄も5桁。筐体ランプの白(不明)はランプと同じ', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  app.ev('const d = getData(); d.detail.nRep = 158; d.detail.lnChe = 2; d.cur.suika = 3; d.detail.lbSui = 1; d.detail.wBig = 1;');
  app.window.setDummyDefault(true);
  assert.equal(shown(app, '[data-detail="nRep"]').length, 5);
  assert.equal(shown(app, '[data-detail="lnChe"]').length, 5);
  app.window.switchDetailScreen();
  assert.equal(shown(app, '[data-take="suika"]').length, 5);
  assert.equal(shown(app, '[data-detail="lbSui"]').length, 5);
  assert.equal(shown(app, '[data-detail="wBig"]').length, 3);
  // タップした後の書き換えでも5桁のまま
  app.window.switchDetailScreen();
  app.ev('refreshMainValues();');
  assert.equal(shown(app, '[data-detail="nRep"]').length, 5);
});

test('ダミー表示中も機種名は薄くしない', () => {
  const app = loadApp({ storage: { machine: 'newking', dummyDefault: true } });
  assert.equal(app.ev('dummyMode'), true);
  assert.notEqual(app.document.getElementById('disp-machine').style.opacity, '0.5');
});

test('カウントロックの画面: 説明文なし。ボタンはメイン画面と同じ（数値を出し、ロックは暗くして🔒）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('getData().cur.bell = 123; renderMain();');
  app.window.openModal('lock-modal');
  assert.equal(app.document.querySelector('#lock-modal .gas-note'), null, '説明文は出さない');
  assert.equal(app.document.querySelector('#lock-body [data-lock="bell"] .value').textContent, '123', 'メイン画面と同じく数値を出す');
  assert.ok(app.document.querySelector('#lock-body [data-lock="start-g"]').classList.contains('locked'));
  const css = app.document.querySelector('style').textContent;
  assert.doesNotMatch(css, /\.lock-cell\s*\{[^}]*min-height/, 'ボタンの大きさはメイン画面と同じ');
  assert.doesNotMatch(css, /\.lock-cell \.value\s*\{/, '数値の大きさもメイン画面と同じ');
  assert.doesNotMatch(css, /\.lock-cell\.locked::after\s*\{\s*content:\s*none/, 'ロックの🔒もメイン画面と同じ');
});

test('設定画面: カウントロック・データ保存・リセットのボタンの間隔をそろえる（20px）', () => {
  const app = loadApp();
  const css = app.document.querySelector('style').textContent;
  assert.match(css, /\.lock-btn\s*\{[^}]*margin-top:\s*20px/);
  assert.match(css, /\.export-btn\s*\{[^}]*margin-top:\s*20px/);
  const reset = [...app.document.querySelectorAll('#setting-modal button')].find((b) => b.textContent === 'リセット');
  assert.match(reset.getAttribute('style'), /margin-top:\s*20px/);
});

test('カウントロックの画面のダミー表示は、メイン画面と同じ数（詳細記録の画面2も）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  app.ev('const d = getData(); d.detail.btBell = 7; d.cur.bell = 55;');
  app.window.setDummyDefault(true);
  app.window.switchDetailScreen(); // メイン画面は画面2
  const main = app.document.querySelector('#main-ui [data-detail="btBell"] .value').textContent;
  app.window.openModal('lock-modal');
  assert.equal(app.document.querySelector('#lock-body [data-lock="btBell"] .value').textContent, main);
});

test('カウントロックの画面: 入力モード＋ダミー表示でも、数値の大きさをメイン画面と同じにする', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('getData().cur.bell = 55;');
  app.window.setInputMode('input');
  app.window.setDummyDefault(true);
  app.window.openModal('lock-modal');
  const size = (sel) => app.document.querySelector(sel).style.fontSize;
  assert.equal(size('#lock-body [data-lock="bell"] .value'), size('#main-ui [data-id="bell"] .value'));
  assert.equal(size('#lock-body [data-lock="bell"] .value'), '14px');
  assert.equal(size('#lock-body [data-lock="start-g"] .value'), size('#main-ui [data-start="g"] .value'), 'ロック中は今までの大きさ');
  assert.equal(size('#lock-body [data-lock="big0"] .value'), size('#main-ui [data-type="big"][data-idx="0"] .value'));
});
