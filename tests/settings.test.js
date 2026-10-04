// 段階1: 設定の整理（「全て」表示の廃止・打ち始めの操作・数値表示・機種名の操作・設定画面のコンパクト化）
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const settingsIds = (app) => [...app.document.querySelectorAll('#setting-modal [id]')].map((e) => e.id);

test('「全て」表示は廃止: 設定に切替が無く、古い保存データの「全て」も個人で計算する', () => {
  const app = loadApp({
    storage: {
      machine: 'newking', viewMode: 'total',
      newking: { start: { g: 1000, b: 5, r: 3 }, cur: { g: 2000, b: 9, r: 5, bell: 133 } },
    },
  });
  assert.ok(!settingsIds(app).some((id) => id.startsWith('btn-view-')), '個人/全ての切替ボタンが無い');
  app.ev('calc()');
  const rows = app.document.getElementById('detail-rows').textContent;
  assert.match(rows, /通常時回転数1000回転/, '打ち始めからの差分（個人）で計算');
  assert.match(rows, /4回/, 'BIG は 9 − 5 = 4');
  assert.doesNotMatch(app.document.getElementById('title-predict').textContent, /全て/);
});

test('打ち始め: 初期値はロック（旧「打ち始めの操作: できない」）。メイン画面の＜打ち始め＞はタップしても変わらない', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  assert.equal(app.ev('data.countLock["start-g"]'), true);
  assert.equal(app.document.querySelector('#main-ui [data-start="g"].t-btn'), null, 'タップできるセルになっていない');
  assert.ok(!settingsIds(app).includes('start-g'), '設定画面の打ち始めの入力欄は削除');
});

test('打ち始めの操作: 「できる」ならタップで打ち始めが変わり、現在も同じだけずれる（個人の数値は変わらない）', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`const d = getData(); d.start = { g: 1000, b: 5, r: 3 }; d.cur.g = 1300; d.cur.b = 7; d.cur.r = 4; renderMain();`);
  ['start-g', 'start-b', 'start-r'].forEach((k) => app.window.toggleCountLock(k)); // 打ち始めのロックを外す（旧「打ち始めの操作: できる」）
  await app.tap('#main-ui [data-start="g"]'); // +50
  assert.equal(app.ev('getData().start.g'), 1050);
  assert.equal(app.ev('getData().cur.g'), 1350);
  await app.tap('#main-ui [data-start="b"]', { long: true }); // −1
  assert.equal(app.ev('getData().start.b'), 4);
  assert.equal(app.ev('getData().cur.b'), 6);
  assert.equal(app.document.querySelector('#main-ui [data-start="g"] .value').textContent, '1050');
  assert.equal(app.document.querySelector('#main-ui [data-id="g"] .value').textContent, '1350');
  await app.tap('#main-ui [data-start="g"]', { long: true }); // G の長押しは＜現在＞の G と同じく −50
  assert.equal(app.ev('getData().start.g'), 1000);
  assert.equal(app.ev('getData().cur.g'), 1300);
  // 0 未満にはしない
  app.ev('getData().start.r = 0; getData().cur.r = 2; renderMain();');
  await app.tap('#main-ui [data-start="r"]', { long: true });
  assert.equal(app.ev('getData().start.r'), 0);
  assert.equal(app.ev('getData().cur.r'), 2);
  assert.equal(app.ev('getData().hits.length'), 0, '打ち始めの BIG/REG では当選履歴を作らない');
});

test('打ち始めの操作: 入力モードでも「できる」なら入力でき、現在も同じだけずれる', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`const d = getData(); d.start = { g: 1000, b: 5, r: 3 }; d.cur.g = 1300; d.cur.b = 7; d.cur.r = 4;`);
  ['start-g', 'start-b', 'start-r'].forEach((k) => app.window.toggleCountLock(k)); // 打ち始めのロックを外す（旧「打ち始めの操作: できる」）
  app.window.setInputMode('input');
  const input = app.document.querySelector('#main-ui [data-start="g"] input');
  input.value = '900';
  input.dispatchEvent(new app.window.Event('change'));
  assert.equal(app.ev('getData().start.g'), 900);
  assert.equal(app.ev('getData().cur.g'), 1200);
});

test('数値表示: 設定を変えるとすぐ切り替わり、再読込後もその設定で表示する', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('getData().cur.bell = 400; renderMain();');
  app.window.setDummyDefault(true);
  assert.equal(app.ev('data.dummyDefault'), true);
  assert.equal(app.ev('dummyMode'), true);
  assert.ok(app.document.getElementById('btn-dummy-hide').classList.contains('active-mode'));
  const shown = app.document.querySelector('#main-ui [data-id="bell"] .value').textContent;
  assert.notEqual(shown, '400');
  assert.equal(shown.slice(2, 5), '400', '隠す（前後に2桁ずつ数字を足す）');
  app.window.setDummyDefault(false);
  assert.equal(app.document.querySelector('#main-ui [data-id="bell"] .value').textContent, '400');
  const reloaded = loadApp({ storage: { machine: 'newking', dummyDefault: true } });
  assert.equal(reloaded.ev('dummyMode'), true);
});

test('機種名: 長押しでまとめて加算。タップでは何もしない（詳細記録 OFF のとき）', async () => {
  const app = loadApp();
  const bulk = () => app.document.getElementById('bulk-panel').classList.contains('active');
  app.window.startMachinePress();
  app.window.endMachinePress();
  assert.ok(!bulk(), 'タップではまとめて加算は開かない');
  assert.equal(app.ev('dummyMode'), false, 'タップでダミー表示にもならない');
  app.window.startMachinePress();
  await new Promise((r) => setTimeout(r, 600)); // 550ms で長押し
  app.window.endMachinePress();
  assert.ok(bulk(), '長押しでまとめて加算');
  assert.equal(app.ev('dummyMode'), false, '長押しでダミー表示にはならない');
});

// 設定画面の並び（2026-10）は tests/countlock.test.js

test('設定の表記: 数値表示＝デフォルト／ダミー', () => {
  const app = loadApp();
  const text = (id) => app.document.getElementById(id).textContent.trim();
  assert.equal(text('btn-dummy-real'), 'デフォルト');
  assert.equal(text('btn-dummy-hide'), 'ダミー');
  assert.match(app.document.getElementById('setting-modal').textContent, /＜数値表示＞/);
  assert.doesNotMatch(app.document.getElementById('setting-modal').textContent, /起動時の数値表示/);
});
