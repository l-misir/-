// タップで何かが起きるもの（アイコン・機種名・ボタンなど）は、押したら振動する（2026-10-04）。
// メイン画面のセルと同じく、透明な振動用ラベル（中に非表示のスイッチ）をかぶせ、指のタップで直接スイッチを切り替える
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, useManualTimers } = require('./helpers');

const tick = () => new Promise((r) => setTimeout(r, 0)); // 振動用ラベルは描いた後に付ける（MutationObserver）
const hasHaptic = (el) => !!(el && el.querySelector(':scope > label.haptic-tap > input[type="checkbox"][switch]'));

test('ヘッダーのアイコン・機種名・画面を切り替えるタイトルに振動用ラベルを付ける', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  await tick();
  const doc = app.document;
  const icons = [...doc.querySelectorAll('.header-icon[onclick]')];
  assert.ok(icons.length >= 10, '🔍 ⚙️ 🔑 📋 ✕');
  icons.forEach((el) => assert.ok(hasHaptic(el), el.textContent));
  assert.ok(hasHaptic(doc.getElementById('disp-machine')), '機種名');
  assert.ok(hasHaptic(doc.querySelector('#hit-modal .modal-title')), '大当たり分布のタイトル（設定推測へ）');
  // 押しても何も起きないもの（左上の見えない✕・設定推測のタイトル）には付けない
  doc.querySelectorAll('.header-icon:not([onclick])').forEach((el) => assert.ok(!hasHaptic(el)));
  assert.ok(!hasHaptic(doc.querySelector('#predict-modal .modal-title')));
  assert.equal(app.errors.length, 0, app.errors.join('\n'));
});

test('機種名の振動用ラベルは、画面の切替（描き直し）でも消えない', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  await tick();
  const name = app.document.getElementById('disp-machine');
  const label = name.querySelector(':scope > .haptic-tap');
  assert.ok(label);
  app.window.switchDetailScreen();
  app.ev('refreshMainValues();');
  assert.equal(name.querySelector(':scope > .haptic-tap'), label, '同じラベルのまま（押している最中に消すと振動しない）');
  assert.equal(name.querySelectorAll('.haptic-tap').length, 1);
  assert.match(name.textContent, /○ニューキングハナハナⅤ●/, '機種名と ○● はそのまま');
});

test('各画面のボタン（設定・テンキー・当選履歴・確率表・実戦履歴・カウントロック・設定推測の行）にも付ける', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  const doc = app.document;
  await tick();
  ['btn-mode-tap', 'btn-detail-on', 'btn-dummy-hide', 'btn-onebet-actual'].forEach((id) => assert.ok(hasHaptic(doc.getElementById(id)), id));
  [...doc.querySelectorAll('#setting-modal button')].forEach((b) => assert.ok(hasHaptic(b), b.textContent));
  // テンキー（BIG を押すと開く）と契機・告知
  await app.tap('#main-ui [data-id="b"]');
  await tick();
  [...doc.querySelectorAll('#hit-panel .hit-key, #hit-panel .hit-opt, #hit-panel .hit-close')].forEach((el) => assert.ok(hasHaptic(el), el.textContent));
  app.window.hitKey('1');
  app.window.hitEditSave();
  // 大当たり分布
  app.window.openHitModal();
  await tick();
  [...doc.querySelectorAll('.hm-tab, .hm-sub-btn, #hm-content .hm-edit')].forEach((el) => assert.ok(hasHaptic(el), el.className));
  app.window.setHitTab('prob');
  await tick();
  [...doc.querySelectorAll('.set-tab')].forEach((el) => assert.ok(hasHaptic(el)));
  // まとめて加算
  app.window.openBulkPanel();
  await tick();
  [...doc.querySelectorAll('.bulk-target, #bulk-keys .hit-key')].forEach((el) => assert.ok(hasHaptic(el)));
  app.window.closeBulkPanel();
  // カウントロック
  app.window.openModal('lock-modal');
  await tick();
  [...doc.querySelectorAll('#lock-body .lock-cell')].forEach((el) => assert.ok(hasHaptic(el)));
  // 設定推測: タップでグラフが開く行（th・td の両方）。何も起きない行には付けない
  app.ev('calc();');
  await tick();
  const row = doc.getElementById('row-b'); // BIG確率（タップで個別設定推測のグラフ）
  assert.ok(hasHaptic(row.querySelector('th')) && hasHaptic(row.querySelector('td')));
  const plain = doc.getElementById('row-g');
  assert.ok(!hasHaptic(plain.querySelector('th')) && !hasHaptic(plain.querySelector('td')), '通常時回転数は押しても何も起きない');
  assert.equal(app.errors.length, 0, app.errors.join('\n'));
});

test('振動用ラベルを押すと、ボタンの処理は1回だけ（ラベルが中のスイッチへ送る2回目の click では動かない）', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.openModal('lock-modal');
  await tick();
  const doc = app.document;
  const locked = () => !!JSON.parse(app.ev('JSON.stringify(data.countLock)')).bell;
  assert.equal(locked(), false);
  // ロックの切替は押すたびに描き直す（ラベルごと作り直す）ので、2回動くと元に戻ってしまう
  doc.querySelector('#lock-body [data-lock="bell"] > .haptic-tap').click();
  assert.equal(locked(), true, '1回だけ切り替わる');
  await tick();
  doc.querySelector('#lock-body [data-lock="bell"] > .haptic-tap').click();
  assert.equal(locked(), false);
  // ヘッダーのアイコン
  let opened = 0;
  app.window.openHitModal = () => { opened++; };
  doc.querySelector('.header > .header-icon > .haptic-tap').click();
  assert.equal(opened, 1);
});

test('メイン画面: 押せないセル（ロック中・入力モード）には今までどおり付けない', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  await tick();
  const doc = app.document;
  assert.ok(!doc.querySelector('#main-ui [data-start="g"] .haptic-tap'), '打ち始め（初期値はロック）');
  assert.equal(doc.querySelectorAll('#main-ui [data-id="bell"] .haptic-tap').length, 1, 'タップできるセルは今までのラベル1つだけ');
  app.window.setInputMode('input');
  await tick();
  assert.equal(doc.querySelector('#main-ui .haptic-tap'), null);
});

test('データ保存のボタン: 「保存中...」に書き換えた後も振動用ラベルを付け直す', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`data.gasUrl = 'https://example.invalid/exec'; data.gasToken = 't';`);
  await tick();
  const btn = app.document.querySelector('.export-btn');
  assert.ok(hasHaptic(btn));
  app.window.saveToSheet(); // 保存開始で「保存中...」、終わると元の文字に戻す（textContent の書き換え）
  await tick();
  assert.ok(hasHaptic(btn), '保存中');
  await new Promise((r) => setTimeout(r, 50)); // 通信（スタブ）の完了を待つ
  assert.equal(btn.textContent, 'データ保存・画像出力');
  assert.ok(hasHaptic(btn), '保存後');
  assert.equal(btn.querySelectorAll('.haptic-tap').length, 1);
});

// 機種名のタップ（詳細記録の画面1・画面2 の切替）: 離した瞬間に描き直すと iOS がタップを click にせず振動しないので、
// 切替は振動用ラベルの click で行う。click が来なければ 0.4 秒後に切り替える（2026-10-06）
const detailScreenNo = (app) => app.document.querySelector('#main-ui .detail-screen').dataset.screen;
const nameLabel = (app) => app.document.querySelector('#disp-machine > .haptic-tap');
function detailApp() {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  return app;
}

test('機種名のタップ: 離した瞬間には描き直さず、振動用ラベルの click で切り替える（スイッチへの2回目の click では戻らない）', () => {
  const app = detailApp();
  const before = app.document.querySelector('#main-ui .detail-screen');
  app.window.startMachinePress();
  app.window.endMachinePress();
  assert.equal(detailScreenNo(app), '1');
  assert.equal(app.document.querySelector('#main-ui .detail-screen'), before, '離した瞬間には描き直さない');
  nameLabel(app).click();
  assert.equal(detailScreenNo(app), '2');
  assert.match(app.document.getElementById('disp-machine').textContent, /○ニューキングハナハナⅤ●/);
  app.window.startMachinePress();
  app.window.endMachinePress();
  nameLabel(app).click();
  assert.equal(detailScreenNo(app), '1', 'もう一度タップで画面1');
});

test('機種名のタップ: click が来なくても 0.4 秒後には切り替える（遅れて来た click では戻らない）', () => {
  const app = detailApp();
  const advance = useManualTimers(app);
  app.window.startMachinePress();
  app.window.endMachinePress();
  advance(399);
  assert.equal(detailScreenNo(app), '1');
  advance(1);
  assert.equal(detailScreenNo(app), '2', '予備のタイマーで切り替わる');
  nameLabel(app).click();
  assert.equal(detailScreenNo(app), '2');
});

test('機種名: pointercancel の後に click が来たら（振動したら）切り替える。長押し（まとめて加算）の後の click では切り替えない', () => {
  const app = detailApp();
  const advance = useManualTimers(app);
  app.window.startMachinePress();
  app.window.cancelMachinePress();
  nameLabel(app).click();
  assert.equal(detailScreenNo(app), '2');
  app.window.startMachinePress();
  advance(549);
  assert.ok(!app.document.getElementById('bulk-panel').classList.contains('active'));
  advance(1);
  assert.ok(app.document.getElementById('bulk-panel').classList.contains('active'), '550ms で長押し（まとめて加算）');
  app.window.endMachinePress();
  nameLabel(app).click();
  advance(1000);
  assert.equal(detailScreenNo(app), '2', '長押しでは切り替えない');
});

test('機種名の連打: 前のタップの click が来ないうちに次を押しても、前のタップの切替は失わない（次が長押しでも）', () => {
  const app = detailApp();
  const advance = useManualTimers(app);
  app.window.startMachinePress();
  app.window.endMachinePress(); // 1回目: click が来ない
  advance(100);
  app.window.startMachinePress(); // 2回目を押した時点で1回目の分を切り替える
  assert.equal(detailScreenNo(app), '2');
  app.window.endMachinePress();
  advance(400);
  assert.equal(detailScreenNo(app), '1', '2回目の分');
  app.window.startMachinePress();
  app.window.endMachinePress(); // click が来ない
  advance(100);
  app.window.startMachinePress(); // 長押し
  advance(550);
  assert.ok(app.document.getElementById('bulk-panel').classList.contains('active'));
  app.window.endMachinePress();
  advance(1000);
  assert.equal(detailScreenNo(app), '2', '長押しの前のタップの分は切り替わる');
});

test('機種名: pointercancel の後の click は、押し始めから2秒以内だけ切り替える', () => {
  const app = detailApp();
  const advance = useManualTimers(app);
  app.window.startMachinePress();
  app.window.cancelMachinePress();
  advance(2001);
  nameLabel(app).click();
  assert.equal(detailScreenNo(app), '1', '2秒を過ぎた click では切り替えない');
  app.window.startMachinePress();
  app.window.cancelMachinePress();
  advance(2000);
  nameLabel(app).click();
  assert.equal(detailScreenNo(app), '2');
});
