// 大当たり履歴(hits)と通常時G数(cur.g)の整合性
// hits は「先頭が最新」、各 g は「直前の当たりからの区間G（データカウンター表示値）」
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

function setup(state) {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`
    const d = getData();
    d.start = ${JSON.stringify(state.start || { g: 0, b: 0, r: 0 })};
    d.hits = ${JSON.stringify(state.hits || [])};
    d.cur.g = ${state.curG ?? 0};
    hitTailG = ${state.tail ?? 0};
  `);
  return app;
}
const hits = (app) => app.ev('JSON.stringify(getData().hits.map(h => ({ g: h.g, k: h.k })))');
const curG = (app) => app.ev('getData().cur.g');

test('新規当選: ハマり分を二重加算しない', () => {
  // 記録100G + ハマり80G の状態で BIG を引き、80 と入力 → cur.g は 180 のまま
  const app = setup({ hits: [{ g: 100, k: 'b' }], curG: 180 });
  app.ev(`getData().hits.unshift({ g: null, k: 'b', pending: true });`);
  app.window.openHitInput('b');
  app.window.hitKey('8');
  app.window.hitKey('0');
  app.window.hitEditSave();
  assert.equal(curG(app), 180);
  assert.equal(hits(app), JSON.stringify([{ g: 80, k: 'b' }, { g: 100, k: 'b' }]));
});

test('過去記録の編集: 現在のハマりG数は維持', () => {
  const app = setup({ hits: [{ g: 100, k: 'b' }], curG: 180 });
  app.window.editHitG(0);
  ['1', '2', '0'].forEach((k) => app.window.hitKey(k)); // 最初の入力で既存値を上書き
  app.window.hitEditSave();
  assert.equal(curG(app), 200); // 120 + ハマり80
});

test('削除: 区間G数は1つ新しい当たりへ繰り入れる', () => {
  // 時系列: 200G→BIG, 100G→BIG, 50G→REG。真ん中のBIGを消すと REG は 150G
  const app = setup({ hits: [{ g: 50, k: 'r' }, { g: 100, k: 'b' }, { g: 200, k: 'b' }], curG: 350 });
  app.ev(`removeLatestHit('b')`);
  assert.equal(hits(app), JSON.stringify([{ g: 150, k: 'r' }, { g: 200, k: 'b' }]));
  assert.equal(curG(app), 350);
});

test('削除: 最新の当たりを消すとその区間は現在ハマりへ戻る', () => {
  const app = setup({ hits: [{ g: 120, k: 'b' }, { g: 200, k: 'r' }], curG: 350, tail: 30 });
  app.ev(`removeLatestHit('b')`);
  assert.equal(hits(app), JSON.stringify([{ g: 200, k: 'r' }]));
  assert.equal(curG(app), 350);
});

test('削除: 繰り入れ先が未入力(null)なら null のまま残す', () => {
  const app = setup({ hits: [{ g: null, k: 'r' }, { g: 100, k: 'b' }], curG: 100 });
  app.ev(`removeLatestHit('b')`);
  assert.equal(hits(app), JSON.stringify([{ g: null, k: 'r' }]));
});

test('種別フィルタ: 異種ボーナスの区間を合算する（ユーザー提示の例）', () => {
  // 入力順（古→新）: 300B,300R,100R,95R,35R,220R,10R,80R,100R,230B
  const seq = [[300, 'b'], [300, 'r'], [100, 'r'], [95, 'r'], [35, 'r'], [220, 'r'], [10, 'r'], [80, 'r'], [100, 'r'], [230, 'b']];
  const newestFirst = seq.map(([g, k]) => ({ g, k })).reverse();
  const app = setup({ hits: newestFirst, curG: 1470 });
  const f = (k) => JSON.stringify(app.ev(`buildFilteredHits('${k}').map(h => h.g)`));
  assert.equal(f('b'), '[1170,300]');
  assert.equal(f('r'), '[100,80,10,220,35,95,100,600]');
  app.ev('getData().cur.g += 170');
  assert.equal(app.ev(`currentHamari('all')`), 170);
  assert.equal(app.ev(`currentHamari('b')`), 170);
  assert.equal(app.ev(`currentHamari('r')`), 400); // 170 + 最新BIGの区間230
});

test('確率表: 未入力(null)の記録は実績の母数から除外', () => {
  const app = setup({ hits: [{ g: null, k: 'b' }, { g: 80, k: 'r' }, { g: 250, k: 'b' }], curG: 330 });
  app.ev('calc()');
  app.window.openHitModal();
  app.window.setHitTab('prob');
  const text = app.document.getElementById('hm-content').textContent;
  assert.match(text, /実績 2回/);
});
