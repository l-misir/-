// レトロ条件達成の自動加算
// 連チャン = 前の当たりから100G以内。連チャン中の BIG の数が 2〜4 の間の当たり（BIG・REG）が対象
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

// 時系列（古→新）で書いた当たりを、hits（新しい順）にして数える
function count(app, seq) {
  const hits = seq.map(([g, k]) => ({ g, k })).reverse();
  return app.ev(`retroAutoCount(${JSON.stringify(hits)})`);
}

test('レトロ条件達成の数え方（ユーザー提示の例）', () => {
  const app = loadApp();
  // BIG → 100G以内に BIG = BIG2連 → 1
  assert.equal(count(app, [[300, 'b'], [80, 'b']]), 1);
  // BIG → REG → REG → BIG(BIG2連目) → REG(BIG2連目以降) → 2
  assert.equal(count(app, [[300, 'b'], [50, 'r'], [20, 'r'], [90, 'b'], [10, 'r']]), 2);
  // REG → BIG → BIG(BIG2連目) → 1（REG 始まりでも連チャン中の BIG を数える）
  assert.equal(count(app, [[300, 'r'], [60, 'b'], [70, 'b']]), 1);
});

test('レトロ条件達成: BIG5連目以降は対象外、100G ちょうどは連チャン、101G で途切れる', () => {
  const app = loadApp();
  // BIG6連: 2〜4連目だけ → 3
  assert.equal(count(app, [[300, 'b'], [10, 'b'], [10, 'b'], [10, 'b'], [10, 'b'], [10, 'b']]), 3);
  // BIG4連の後の REG は対象、BIG5連目とその後の REG は対象外 → 3 + 1 = 4
  assert.equal(count(app, [[300, 'b'], [10, 'b'], [10, 'b'], [10, 'b'], [10, 'r'], [10, 'b'], [10, 'r']]), 4);
  assert.equal(count(app, [[300, 'b'], [100, 'b']]), 1, '100G ちょうどは連チャン');
  assert.equal(count(app, [[300, 'b'], [101, 'b']]), 0, '101G は連チャンではない');
  // 途切れたら数え直し: BIG,BIG(1) | 200G で途切れ | BIG,BIG(1) → 2
  assert.equal(count(app, [[300, 'b'], [50, 'b'], [200, 'b'], [50, 'b']]), 2);
});

test('レトロ条件達成: 最初の記録と、G数未入力の当たりは連チャンの始まり扱い', () => {
  const app = loadApp();
  assert.equal(count(app, [[50, 'b']]), 0, '打ち始め最初の当たりは前が分からないので対象外');
  assert.equal(count(app, [[300, 'b'], [null, 'b'], [50, 'b']]), 1, '未入力で途切れ、未入力の BIG から数え直す');
  assert.equal(count(app, [[300, 'b'], [50, 'b'], [null, 'r']]), 1);
});

function setupTap() {
  const app = loadApp();
  app.selectMachine('newking');
  return app;
}
const cur = (app, k) => app.ev(`getData().cur.${k}`);
async function hit(app, kind, digits) {
  await app.tap(`[data-id="${kind}"]`);
  digits.split('').forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
}

test('タップで記録した当たりで自動加算し、手で直した分は残す。取り消し・G数の修正にも追従', async () => {
  const app = setupTap();
  await hit(app, 'b', '300');
  assert.equal(cur(app, 'retro_d'), 0);
  await hit(app, 'b', '80'); // BIG2連
  assert.equal(cur(app, 'retro_d'), 1);
  assert.equal(app.document.querySelector('#main-ui [data-id="retro_d"] .value').textContent, '1');

  await app.tap('[data-id="retro_d"]', { long: true }); // 後告知だったので手で -1
  assert.equal(cur(app, 'retro_d'), 0);
  await hit(app, 'r', '50'); // BIG2連目以降の REG → +1（手で減らした分は残る）
  assert.equal(cur(app, 'retro_d'), 1);

  await app.tap('[data-id="r"]', { long: true }); // その REG を取り消し → -1
  assert.equal(cur(app, 'retro_d'), 0);

  // 2個目の BIG の G数を 80 → 150 に直すと連チャンではなくなる → さらに -1（0 未満にはしない）
  app.window.editHitG(0);
  ['1', '5', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  assert.equal(cur(app, 'retro_d'), 0);
  // 150 → 60 に戻すと +1
  app.window.editHitG(0);
  ['6', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  assert.equal(cur(app, 'retro_d'), 1);
});

test('手で0まで減らした後、当選の G数を同じ値で打ち直しても増えない（入力途中の増減を残さない）', async () => {
  const app = setupTap();
  for (const g of ['300', '50', '120', '50', '50', '50']) await hit(app, 'b', g);
  assert.equal(cur(app, 'retro_d'), 4);
  for (let i = 0; i < 4; i++) await app.tap('[data-id="retro_d"]', { long: true });
  assert.equal(cur(app, 'retro_d'), 0);
  // 3件目（120G）を開いて同じ 120 を入力（途中の 1, 12 は一時的に連チャン扱いになる）
  app.window.editHitG(3);
  ['1', '2', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  assert.equal(app.ev('getData().hits[3].g'), 120);
  assert.equal(cur(app, 'retro_d'), 0);
});

test('BIG を取り消すと、その後の当選の連チャン判定も実際の流れで数え直す', async () => {
  // BIG(300) → BIG(60) → REG(60) で 2。2つ目の BIG が誤タップなら本当は BIG → 120G後に REG で連チャンではない → 0
  const app = setupTap();
  for (const [k, g] of [['b', '300'], ['b', '60'], ['r', '60']]) await hit(app, k, g);
  assert.equal(cur(app, 'retro_d'), 2);
  await app.tap('[data-id="b"]', { long: true });
  assert.equal(app.ev('JSON.stringify(getData().hits.map(h => [h.k, h.g]))'), '[["r",120],["b",300]]');
  assert.equal(cur(app, 'retro_d'), 0);
});

test('まとめて加算で BIG を増やしてもレトロ条件達成は増えない', () => {
  const app = setupTap();
  app.window.openBulkPanel();
  app.window.setBulkTarget('b');
  ['3', 'ok'].forEach((k) => app.window.bulkKey(k));
  assert.equal(cur(app, 'retro_d'), 0);
});

test('以前の保存データ: 読み込んだだけではレトロ条件達成を変えない（その後の変化分だけ反映）', () => {
  // 手で数えたレトロ達成 5、当選履歴は BIG2連（自動なら1）を含む
  const app = loadApp({
    storage: {
      machine: 'newking',
      newking: { cur: { g: 380, b: 2, r: 0, retro_d: 5 }, hits: [{ g: 80, k: 'b' }, { g: 300, k: 'b' }] },
    },
  });
  assert.equal(cur(app, 'retro_d'), 5);
  app.ev(`removeLatestHit('b')`); // 対象だった BIG を取り消し → -1
  assert.equal(cur(app, 'retro_d'), 4);
});
