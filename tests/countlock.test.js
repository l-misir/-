// カウントロック（2026-10）: 項目ごとに、メイン画面でのタップ・入力を止める。設定の「カウントロック」から専用画面で切り替える。
// 旧設定「ベルのタップ」「打ち始めの操作」をまとめたもの。まとめて加算・ショートカットのベル送信では今までどおり変えられる。
// あわせて「タップ時の振動」の設定を無くし（常に ON）、要素調整を管理画面へ移す
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const locks = (app) => JSON.parse(app.ev('JSON.stringify(data.countLock)'));
const lockKeys = (app) => [...app.document.querySelectorAll('#lock-body [data-lock]')].map((e) => e.dataset.lock);
// ロックしたセル: タップ処理・振動用ラベルを付けず、暗くして表示だけ
const isLockedCell = (app, sel) => {
  const el = app.document.querySelector(`#main-ui ${sel}`);
  return el.classList.contains('locked') && !el.classList.contains('t-btn') && !el.querySelector('.haptic-tap');
};
const START = { 'start-g': true, 'start-b': true, 'start-r': true };

test('初期値: 打ち始めの3つだけロック（旧「打ち始めの操作」の初期値 OFF と同じ）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  assert.deepEqual(locks(app), START);
  assert.ok(isLockedCell(app, '[data-start="g"]'));
  assert.ok(!isLockedCell(app, '[data-id="bell"]'));
  assert.ok(app.document.querySelector('#main-ui [data-id="bell"]').classList.contains('t-btn'));
});

test('古い保存データ: 「ベルのタップ OFF」「打ち始めの操作 ON」を引き継ぎ、振動・ベル・打ち始めの設定は消す', () => {
  const app = loadApp({ storage: { machine: 'king', bellTap: false, startTap: true, haptic: false } });
  assert.deepEqual(locks(app), { bell: true });
  assert.deepEqual(app.ev('[typeof data.bellTap, typeof data.startTap, typeof data.haptic].join()'), 'undefined,undefined,undefined');
  assert.ok(isLockedCell(app, '[data-id="bell"]'));
  assert.ok(app.document.querySelector('#main-ui [data-start="g"]').classList.contains('t-btn'), '打ち始めは操作できる');
  const old = loadApp({ storage: { machine: 'king' } }); // どちらの設定も無い保存データ
  assert.deepEqual(locks(old), START);
  const broken = loadApp({ storage: { machine: 'king', countLock: ['x'] } });
  assert.deepEqual(locks(broken), START, '壊れた値は古い設定から作り直す');
});

test('専用画面: 設定の「カウントロック」で開き、今の画面の項目が並ぶ。押すとロック／解除', () => {
  const app = loadApp();
  app.selectMachine('newking');
  const btn = [...app.document.querySelectorAll('#setting-modal button')].find((b) => b.textContent.includes('カウントロック'));
  assert.ok(btn, '設定画面にボタン');
  app.window.openModal('lock-modal');
  assert.equal(app.document.querySelector('#lock-modal .modal-title').textContent, 'カウントロック');
  assert.deepEqual(lockKeys(app), ['start-g', 'start-b', 'start-r', 'g', 'b', 'r', 'bell', 'suika', 'suikaR',
    'regS0', 'regS1', 'regS2', 'regS3', 'regS4', 'big0', 'big1', 'big2', 'big3', 'big4',
    'regT0', 'regT1', 'regT2', 'regT3', 'retro_d', 'retro']);
  const cell = () => app.document.querySelector('#lock-body [data-lock="bell"]');
  assert.ok(!cell().classList.contains('locked'));
  app.window.toggleCountLock('bell');
  assert.ok(cell().classList.contains('locked'), 'ロック画面の表示も切り替わる');
  assert.equal(locks(app).bell, true);
  assert.ok(isLockedCell(app, '[data-id="bell"]'), 'メイン画面のベルはタップできない');
  app.window.toggleCountLock('bell');
  assert.equal(locks(app).bell, undefined);
  assert.ok(!isLockedCell(app, '[data-id="bell"]'));
  app.window.toggleCountLock('start-g');
  assert.ok(app.document.querySelector('#main-ui [data-start="g"]').classList.contains('t-btn'), '打ち始めのロックを外すと操作できる');
});

test('専用画面（詳細記録 ON）: 画面1・画面2 の全項目が並ぶ', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  app.window.openModal('lock-modal');
  assert.deepEqual(lockKeys(app), ['start-g', 'start-b', 'start-r', 'g', 'b', 'r', 'nRep', 'bell', 'nChe', 'nSui',
    'lnChe', 'nCheM', 'lnSui', 'lAlign', 'rChe', 'take-suikaR', 'lrChe', 'lrSui',
    'bChe', 'take-suika', 'btRep', 'btBell', 'lbChe', 'lbSui', 'lblSui', 'lblBell',
    'regS0', 'regS1', 'regS2', 'regS3', 'regS4', 'wBig', 'big0', 'big1', 'big2', 'big3', 'big4',
    'wReg', 'regT0', 'regT1', 'regT2', 'regT3', 'retro_d', 'retro']);
  assert.match(app.document.getElementById('lock-body').textContent, /画面1[\s\S]*画面2/);
  assert.equal(app.ev('detailScreen'), 1, 'メイン画面の表示中の画面は変えない');
  app.window.toggleCountLock('nRep');
  app.window.toggleCountLock('take-suika');
  app.window.toggleCountLock('big0');
  assert.ok(isLockedCell(app, '[data-detail="nRep"]'));
  app.window.switchDetailScreen();
  assert.ok(isLockedCell(app, '[data-take="suika"]'));
  assert.ok(isLockedCell(app, '[data-type="big"][data-idx="0"]'));
});

test('ロックした項目は入力モードでも変えられない。まとめて加算では入れられる', () => {
  const app = loadApp();
  app.selectMachine('king');
  app.window.toggleCountLock('suika');
  app.window.setInputMode('input');
  const cell = app.document.querySelector('#main-ui [data-id="suika"]');
  assert.equal(cell.querySelector('input'), null, '入力欄を出さない');
  assert.ok(cell.classList.contains('locked'));
  assert.ok(app.document.querySelector('#main-ui [data-id="bell"] input'), 'ロックしていない項目は入力できる');
  app.window.setInputMode('tap');
  app.window.openBulkPanel();
  app.window.setBulkTarget('suika');
  ['3', 'ok'].forEach((k) => app.window.bulkKey(k));
  app.window.closeBulkPanel();
  assert.equal(app.ev('getData().cur.suika'), 3);
  assert.equal(app.document.querySelector('#main-ui [data-id="suika"] .value').textContent, '3');
});

test('タップ時の振動は設定なしで常に ON（全セルに振動用ラベル、vibrate 対応端末では振動）', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  const cells = [...app.document.querySelectorAll('#main-ui .t-btn, #main-ui .t-lamp')];
  assert.ok(cells.length > 20);
  assert.ok(cells.every((c) => c.querySelector('label.haptic-tap > input[type="checkbox"][switch]')));
  assert.equal(app.document.getElementById('btn-haptic-on'), null);
  let calls = 0;
  app.window.navigator.vibrate = () => { calls++; return true; };
  await app.tap('#main-ui [data-id="bell"]');
  assert.equal(calls, 1);
});

test('設定画面: ＜入力モード＞＜詳細記録＞ / ＜数値表示＞＜1枚掛けの計算＞。振動・ベルのタップ・打ち始めの操作・要素調整は無い', () => {
  const app = loadApp();
  const doc = app.document;
  const pairs = [...doc.querySelectorAll('#setting-modal .setting-pair')];
  const titles = pairs.map((p) => [...p.querySelectorAll('.section-title')].map((e) => e.textContent));
  assert.deepEqual(titles, [['＜入力モード＞', '＜詳細記録＞'], ['＜数値表示＞', '＜1枚掛けの計算＞']]);
  ['btn-haptic-on', 'btn-belltap-on', 'btn-starttap-on'].forEach((id) => assert.equal(doc.getElementById(id), null, id));
  assert.equal(doc.querySelector('#setting-modal #weight-settings'), null);
  const adminTitles = [...doc.querySelectorAll('#admin-modal .section-title')].map((e) => e.textContent);
  assert.deepEqual(adminTitles, ['＜設定推測：要素調整＞', '＜操作ログ＞', '＜スプレッドシート連携＞']);
  assert.ok(doc.querySelector('#admin-modal #weight-settings').children.length > 0, '要素調整は管理画面で描く');
  const order = [...doc.querySelectorAll('body > div[id]')].map((e) => e.id);
  assert.ok(order.indexOf('lock-modal') > order.indexOf('setting-modal'), 'カウントロックは設定画面より手前に重なる');
});
