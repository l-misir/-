// 段階3: 当選の契機・告知の記録と、レトロ条件達成の自動加算のフリーズ除外（docs/DETAIL_MODE_PLAN.md「当選の契機・告知」）
// 契機: 単独(先)/単独(後)/チェリー/スイカ/リプレイ/ベル から1つ（初期値 単独(先)）
// 告知: ノーマル点滅/プレミア点滅/フリーズ から1つ（初期値 ノーマル点滅）＋ 特殊テンパイ音/バイブ/アメイジングチャンス（複数可）
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const stored = (app) => JSON.parse(app.window.localStorage.getItem('hana_v20_data'));
const hitAt = (app, i) => JSON.parse(app.ev(`JSON.stringify(getData().hits[${i}])`));
const optOn = (app, v) => app.document.querySelector(`#hit-panel [data-opt="${v}"]`).classList.contains('on');

function setup() {
  const app = loadApp();
  app.selectMachine('newking');
  return app;
}
async function hit(app, kind, digits) {
  await app.tap(`#main-ui [data-id="${kind}"]`);
  digits.split('').forEach((k) => app.window.hitKey(k));
}

test('BIG/REG を押して作った当選は、契機 単独(先)・告知 ノーマル点滅・付随なし。テンキー画面にボタンが出る', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  const h = hitAt(app, 0);
  assert.equal(h.trig, 'solo1');
  assert.equal(h.notice, 'normal');
  assert.deepEqual(h.extras, []);
  const opts = [...app.document.querySelectorAll('#hit-panel [data-opt]')].map((e) => e.dataset.opt);
  assert.deepEqual(opts, ['solo1', 'solo2', 'che', 'sui', 'rep', 'bell', 'normal', 'premium', 'freeze', 'tenpai', 'vibe', 'ac']);
  assert.ok(optOn(app, 'solo1'));
  assert.ok(optOn(app, 'normal'));
  assert.ok(!optOn(app, 'tenpai'));
});

test('テンキー画面で契機・告知を選ぶ: 契機と点滅/フリーズは1つだけ、テンパイ音・バイブ・アメイジングチャンスは複数', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  app.window.setHitTrig('che');
  app.window.setHitNotice('premium');
  app.window.toggleHitExtra('vibe');
  app.window.toggleHitExtra('ac');
  app.window.toggleHitExtra('tenpai');
  app.window.toggleHitExtra('tenpai'); // もう一度押すと外れる
  const h = hitAt(app, 0);
  assert.equal(h.trig, 'che');
  assert.equal(h.notice, 'premium');
  assert.deepEqual([...h.extras].sort(), ['ac', 'vibe']);
  assert.ok(optOn(app, 'che') && !optOn(app, 'solo1'), '押したボタンだけ点く');
  assert.ok(optOn(app, 'premium') && !optOn(app, 'normal'));
  assert.ok(optOn(app, 'vibe') && optOn(app, 'ac') && !optOn(app, 'tenpai'));
  app.window.setHitNotice('freeze');
  assert.equal(hitAt(app, 0).notice, 'freeze', '点滅とフリーズは同時に起きない（1つだけ）');
  assert.equal(hitAt(app, 0).g, 300, 'G数はそのまま');
  assert.equal(stored(app).newking.hits[0].trig, 'che', '保存される');
});

test('当選履歴から開くと、その当選の契機・告知が出て、その当選だけを直せる', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  app.window.hitEditSave();
  await hit(app, 'r', '120');
  app.window.hitEditSave();
  // 古い方（BIG、hits[1]）を直す
  app.window.editHitG(1);
  assert.ok(optOn(app, 'solo1'));
  app.window.setHitTrig('rep');
  app.window.hitEditSave();
  assert.equal(hitAt(app, 1).trig, 'rep');
  assert.equal(hitAt(app, 0).trig, 'solo1', '新しい方は変わらない');
  assert.equal(hitAt(app, 1).g, 300);
});

test('古い保存データの当選（契機・告知なし・壊れた値）は初期値で補う', () => {
  const app = loadApp({
    storage: {
      machine: 'king',
      king: { hits: [{ g: 50, k: 'b', pre: 50 }, { g: 300, k: 'r', trig: 'xxx', notice: 'freeze', extras: ['vibe', 'bad', 'vibe'] }] },
    },
  });
  assert.deepEqual(
    [hitAt(app, 0).trig, hitAt(app, 0).notice, hitAt(app, 0).extras],
    ['solo1', 'normal', []],
  );
  assert.deepEqual(
    [hitAt(app, 1).trig, hitAt(app, 1).notice, hitAt(app, 1).extras],
    ['solo1', 'freeze', ['vibe']],
  );
});

// 時系列（古→新）で書いた当たりを、hits（新しい順）にして数える。3つ目は告知
function count(app, seq) {
  const hits = seq.map(([g, k, notice]) => ({ g, k, notice: notice || 'normal' })).reverse();
  return app.ev(`retroAutoCount(${JSON.stringify(hits)})`);
}

test('レトロ条件達成: フリーズの当選自身は対象外。ただし連チャン中の BIG の数には数える', () => {
  const app = loadApp();
  assert.equal(count(app, [[300, 'b'], [50, 'b'], [30, 'b']]), 2, 'BIG3連 → 2連目・3連目で 2');
  assert.equal(count(app, [[300, 'b'], [50, 'b', 'freeze'], [30, 'b']]), 1, '2連目がフリーズ → 3連目だけ');
  // フリーズの BIG も連チャンの BIG に数えるので、その後の5連目は対象外のまま
  assert.equal(count(app, [[300, 'b'], [10, 'b', 'freeze'], [10, 'b'], [10, 'b'], [10, 'b']]), 2);
  assert.equal(count(app, [[300, 'b', 'freeze'], [50, 'b']]), 1, '最初の当たりのフリーズは元々対象外。次の BIG は2連目');
  assert.equal(count(app, [[300, 'b'], [50, 'b', 'premium']]), 1, 'プレミア点滅は外さない');
});

test('テンキー画面でフリーズにすると、レトロ条件達成が1減り、戻すと元に戻る（手で直した分は残す）', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  app.window.hitEditSave();
  await hit(app, 'b', '80'); // BIG2連 → +1
  app.window.hitEditSave();
  assert.equal(app.ev('getData().cur.retro_d'), 1);
  app.ev('getData().cur.retro_d += 2; save(true);'); // 手で +2
  app.window.editHitG(0);
  app.window.setHitNotice('freeze');
  assert.equal(app.ev('getData().cur.retro_d'), 2, '3 − 1');
  app.window.setHitNotice('normal');
  assert.equal(app.ev('getData().cur.retro_d'), 3);
  app.window.setHitNotice('freeze');
  app.window.hitEditSave();
  assert.equal(app.ev('getData().cur.retro_d'), 2);
  assert.equal(stored(app).newking.cur.retro_d, 2);
});

test('当選履歴の一覧: 初期値以外の契機・告知を小さく表示する', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  app.window.hitEditSave();
  await hit(app, 'r', '120');
  app.window.setHitTrig('che');
  app.window.setHitNotice('freeze');
  app.window.toggleHitExtra('vibe');
  app.window.hitEditSave();
  app.window.openHitModal();
  const rows = [...app.document.querySelectorAll('#hm-content .hm-row')];
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /チェリー/);
  assert.match(rows[0].textContent, /フリーズ/);
  assert.match(rows[0].textContent, /バイブ/);
  assert.equal(rows[1].querySelector('.hm-tags'), null, '初期値だけの当選は何も出さない');
});

test('テンキー画面: 当選履歴からの編集は中央表示（キーは今までの大きさ）、BIG/REG 加算時は画面下まで伸ばす表示', async () => {
  const app = setup();
  const panel = app.document.getElementById('hit-panel');
  await hit(app, 'b', '300');
  assert.ok(!panel.classList.contains('centered'), 'BIG/REG 加算時: キーは空いた高さに合わせて縮む');
  app.window.hitEditSave();
  app.window.editHitG(0);
  assert.ok(panel.classList.contains('centered'), '当選履歴から: 中央表示');
  app.window.hitEditSave();
  await hit(app, 'r', '50');
  assert.ok(!panel.classList.contains('centered'), '次の加算では外れる');
});
