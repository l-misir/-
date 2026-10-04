// メイン画面: 押したボタンの下に増減（+1 / -1）を出し、一定時間で消す（指でセルが隠れても結果が分かるように）
// 消える前に同じボタンを操作したら、合計を表示し直して消えるまでの時間をリセットする（例: 2回タップで +2、タップ→長押しで ±0）
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// テストの後に画面を閉じる（出したままの表示のタイマーでテストの終了が遅れないように）
const apps = [];
test.afterEach(() => { while (apps.length) apps.pop().window.close(); });
function setup() {
  const app = loadApp();
  apps.push(app);
  app.selectMachine('newking');
  app.ev('getData().cur.bell = 10; getData().cur.retro = 0; renderMain();');
  // テストを並列で走らせると待ち時間が延びて 1.5 秒で消えてしまうので、時間を確かめるテスト以外は長くする
  app.ev('tapDeltaMs = 60000');
  return app;
}
const deltas = (app) => [...app.document.querySelectorAll('#tap-delta-layer .tap-delta')];
const deltaText = (app, key) => {
  const el = app.document.querySelector(`#tap-delta-layer .tap-delta[data-key="${key}"]`);
  return el ? el.textContent : null;
};

test('タップで +1、長押しで -1 をボタンの下に出す', async () => {
  const app = setup();
  await app.tap('#main-ui [data-id="bell"]');
  assert.equal(deltaText(app, 'bell'), '+1');
  const app2 = setup();
  await app2.tap('#main-ui [data-id="bell"]', { long: true });
  assert.equal(deltaText(app2, 'bell'), '-1');
});

test('消える前に同じボタンを操作したら合計を出す（2回タップで +2、タップ→長押しで ±0）', async () => {
  const app = setup();
  await app.tap('#main-ui [data-id="bell"]');
  await app.tap('#main-ui [data-id="bell"]');
  assert.equal(deltaText(app, 'bell'), '+2');
  await app.tap('#main-ui [data-id="bell"]', { long: true });
  assert.equal(deltaText(app, 'bell'), '+1');
  const app2 = setup();
  await app2.tap('#main-ui [data-id="bell"]');
  await app2.tap('#main-ui [data-id="bell"]', { long: true });
  assert.equal(deltaText(app2, 'bell'), '±0');
  assert.equal(deltas(app2).length, 1, '同じボタンの表示は1つ');
});

test('実際の増減を出す（ゲーム数は +50、下限で変わらなければ ±0）。ボタンごとに別々に出す', async () => {
  const app = setup();
  await app.tap('#main-ui [data-id="g"]');
  await app.tap('#main-ui [data-id="g"]');
  assert.equal(deltaText(app, 'g'), '+100');
  await app.tap('#main-ui [data-id="retro"]', { long: true }); // 0 で長押し
  assert.equal(deltaText(app, 'retro'), '±0');
  await app.tap('#main-ui .t-lamp[data-type="big"][data-idx="1"]');
  assert.equal(deltaText(app, 'big1'), '+1', 'ランプも出す');
  assert.equal(deltaText(app, 'g'), '+100', '別のボタンの表示はそのまま');
  assert.equal(deltas(app).length, 3);
});

test('一定時間で消え、消える前に操作すると時間をリセットする。消えた後はまた +1 から', async () => {
  const app = setup();
  // テスト用に短く（本番は 4.1 秒）。ほかのテストと並んで重くなってもずれないよう、待ち時間には余裕を持たせる
  app.ev('tapDeltaMs = 1000');
  await app.tap('#main-ui [data-id="bell"]');
  await wait(600);
  await app.tap('#main-ui [data-id="bell"]'); // ここで時間をリセット
  await wait(600);
  assert.equal(deltaText(app, 'bell'), '+2', 'リセットしたのでまだ出ている（最初から 1200ms）');
  await wait(700);
  assert.equal(deltaText(app, 'bell'), null, '最後の操作から 1000ms で消える');
  await app.tap('#main-ui [data-id="bell"]');
  assert.equal(deltaText(app, 'bell'), '+1', '消えた後は数え直し');
});

test('画面を描き直しても表示は残る（メイン画面の外の層に出す）。触れない（押した操作を邪魔しない）', async () => {
  const app = setup();
  await app.tap('#main-ui [data-id="bell"]');
  app.window.renderMain();
  assert.equal(deltaText(app, 'bell'), '+1');
  const layer = app.document.getElementById('tap-delta-layer');
  assert.ok(!app.document.getElementById('main-ui').contains(layer));
  assert.match(app.document.documentElement.innerHTML, /#tap-delta-layer \{[^}]*pointer-events: none/);
});
