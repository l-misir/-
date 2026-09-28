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
  app.ev(`getData().hits.unshift({ g: null, k: 'b' });`);
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

test('削除: 当選記録後にタップで足したG数は消えない', () => {
  // BIG を 120G で記録 → G数を50足して170G → BIG を長押しで削除。ハマりは 170G のまま
  const app = setup({ hits: [], curG: 120 });
  app.ev(`getData().hits.unshift({ g: null, k: 'b' });`);
  app.window.openHitInput('b');
  ['1', '2', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  app.ev('getData().cur.g += 50'); // ゲーム数セルのタップ(+50)と同じ
  app.ev(`removeLatestHit('b')`);
  assert.equal(hits(app), '[]');
  assert.equal(curG(app), 170);
});

test('削除: 再読込で hitTailG が 0 に戻っていてもハマりは消えない', () => {
  // 記録300G・ハマり80G(cur.g=380) の状態で再読込した想定（hitTailG は保存されない）
  const app = setup({ hits: [{ g: 100, k: 'r' }, { g: 200, k: 'b' }], curG: 380, tail: 0 });
  app.ev(`removeLatestHit('r')`);
  assert.equal(hits(app), JSON.stringify([{ g: 200, k: 'b' }]));
  assert.equal(curG(app), 380);
});

test('削除: 最新の当たりを消すと、押す前のハマりに戻る（押した後に足した分は残す）', async () => {
  // 前回BIG(200G)から G数タップで50G → 誤ってBIG → 80 と入力 → BIG を長押しで削除
  const app = setup({ hits: [{ g: 200, k: 'b' }], curG: 200 });
  app.ev('getData().cur.b = 1; renderMain();');
  await app.tap('[data-id="g"]'); // +50 → 250（ハマり50）
  await app.tap('[data-id="b"]'); // 誤って BIG
  ['8', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  assert.equal(curG(app), 280); // 入力した80Gが記録になる
  app.ev(`removeLatestHit('b')`);
  assert.equal(hits(app), JSON.stringify([{ g: 200, k: 'b' }]));
  assert.equal(curG(app), 250, '押す前のハマり50Gに戻る');

  // 押した後にタップで足した分は残る
  await app.tap('[data-id="b"]');
  ['8', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave(); // 280
  await app.tap('[data-id="g"]'); // +50 → 330
  app.ev(`removeLatestHit('b')`);
  assert.equal(curG(app), 300, '押す前のハマり50 + 押した後の50');
});

test('削除: 1つ古い当たりを消したら、新しい当たりの「押す前のハマり」も古い区間の分だけ伸びる', async () => {
  // 200G で BIG → 50G ハマって REG(80と入力) → BIG を消す → REG も消す
  const app = setup({ hits: [{ g: 200, k: 'b' }], curG: 250 });
  app.ev('getData().cur.b = 1; getData().cur.r = 0; renderMain();');
  await app.tap('[data-id="r"]');
  ['8', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave(); // 280
  app.ev(`removeLatestHit('b')`); // BIG の200Gは REG へ繰り入れ → REG 280G
  assert.equal(hits(app), JSON.stringify([{ g: 280, k: 'r' }]));
  app.ev(`removeLatestHit('r')`); // 押す前は「打ち始めから 250G」
  assert.equal(curG(app), 250);
});

test('削除: 未入力のまま閉じた当選を消すと、消えていたハマりも戻る', async () => {
  const app = setup({ hits: [{ g: 100, k: 'b' }], curG: 180 });
  app.ev('getData().cur.r = 0; renderMain();');
  await app.tap('[data-id="r"]');
  app.window.closeHitPanel(); // 未入力 → ハマり80が一旦消える（仕様）
  assert.equal(curG(app), 100);
  app.ev(`removeLatestHit('r')`);
  assert.equal(curG(app), 180);
});

test('削除: BIG を押して未入力のまま再読込しても、削除でハマりを二重に足さない', async () => {
  // 打ち始め1000、既存BIG区間200、現在1250（ハマり50）→ BIG をタップ → 入力せずに再読込 → BIG を削除
  const app = setup({ start: { g: 1000, b: 0, r: 0 }, hits: [{ g: 200, k: 'b' }], curG: 1250 });
  app.ev('getData().cur.b = 1; renderMain();');
  await app.tap('[data-id="b"]');
  app.ev('hitTailG = 0;'); // 再読込で hitTailG は失われる（パネルも閉じないまま）
  app.ev(`removeLatestHit('b')`);
  assert.equal(curG(app), 1250);
});

test('削除: BIG を押して未入力のまま、保存データから起動し直しても二重に足さない（本当の再読込）', async () => {
  const app = setup({ start: { g: 1000, b: 0, r: 0 }, hits: [{ g: 200, k: 'b' }], curG: 1250 });
  app.ev('getData().cur.b = 1; save(true); renderMain();');
  await app.tap('[data-id="b"]');
  const saved = JSON.parse(app.window.localStorage.getItem('hana_v20_data'));
  const app2 = loadApp({ storage: saved }); // パネルを開いたまま再読込
  app2.ev(`removeLatestHit('b')`);
  assert.equal(app2.ev('getData().cur.g'), 1250);
  assert.equal(app2.ev('JSON.stringify(getData().hits.map(h => h.g))'), '[200]');
});

test('BIG/REG を押した瞬間、画面のG数も記録に合わせる（内部値と表示を揃える）', async () => {
  const app = setup({ start: { g: 1000, b: 0, r: 0 }, hits: [{ g: 300, k: 'b' }], curG: 1350 });
  app.ev('getData().cur.b = 1; renderMain();');
  await app.tap('[data-id="b"]');
  assert.equal(curG(app), 1300);
  assert.equal(app.document.querySelector('#main-ui [data-id="g"] .value').textContent, '1300');
});

test('削除: 現在G数を記録の合計より小さく手入力した後でも、誤って押した当選を消せば元のG数に戻る', async () => {
  // 打ち始め1000、BIG区間300、現在1300 → 入力モードで 1100 に → REG を誤って押して 80 → REG を削除
  const app = setup({ start: { g: 1000, b: 0, r: 0 }, hits: [{ g: 300, k: 'b' }], curG: 1300 });
  app.ev('getData().cur.b = 1; getData().cur.r = 0; renderMain();');
  app.window.setInputMode('input');
  const input = app.document.querySelectorAll('#main-ui .val-input')[0];
  input.value = '1100';
  input.dispatchEvent(new app.window.Event('change'));
  app.window.setInputMode('tap');
  await app.tap('[data-id="r"]');
  ['8', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  app.ev(`removeLatestHit('r')`);
  assert.equal(curG(app), 1100);

  // その後、残った BIG の回転数を何も変えずに開いて閉じても 1100 のまま
  app.window.editHitG(0);
  app.window.hitEditSave();
  assert.equal(curG(app), 1100);
});

test('手入力でG数が記録の合計より小さい状態でも、古い記録の削除でG数は増えない', () => {
  // 打ち始め1000、記録 REG100・BIG200（合計300）、現在G数は手入力で 1100
  const app = setup({ start: { g: 1000, b: 0, r: 0 }, hits: [{ g: 100, k: 'r' }, { g: 200, k: 'b' }], curG: 1100 });
  app.ev(`removeLatestHit('b')`); // BIG の200Gは REG へ繰り入れ（合計は変わらない）
  assert.equal(curG(app), 1100);
  // ハマりの表示はマイナスにしない
  app.window.openHitModal();
  assert.equal(app.document.querySelector('.hm-now-g').textContent, '0G');
});

test('削除: 旧データ（押す前のハマりの記録なし）は従来どおり区間をハマりへ戻す', () => {
  const app = setup({ hits: [{ g: 120, k: 'b' }, { g: 200, k: 'r' }], curG: 350 });
  app.ev(`removeLatestHit('b')`);
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

test('確率表: 確率は小数1位で切り捨て（四捨五入しない）', () => {
  // 100G以内の実績は 2/3 = 66.66…% → 66.6%
  const app = setup({ hits: [{ g: 10, k: 'b' }, { g: 20, k: 'r' }, { g: 150, k: 'b' }], curG: 180 });
  app.ev('calc()');
  app.window.openHitModal();
  app.window.setHitTab('prob');
  app.window.setProbSet(0);
  const row100 = [...app.document.querySelectorAll('#hm-content .prob-table tr')]
    .find((tr) => tr.querySelector('.prob-g')?.textContent === '100G');
  assert.equal(row100.querySelector('.prob-ac').textContent, '66.6%');
  const denom = app.ev('ALL_PARAMS.newking.gassan[0]');
  const th = (1 - Math.pow(1 - 1 / denom, 100)) * 100;
  assert.equal(row100.querySelector('.prob-th').textContent, `${(Math.floor(th * 10) / 10).toFixed(1)}%`);
});

test('確率表: 未入力(null)の記録は実績の母数から除外', () => {
  const app = setup({ hits: [{ g: null, k: 'b' }, { g: 80, k: 'r' }, { g: 250, k: 'b' }], curG: 330 });
  app.ev('calc()');
  app.window.openHitModal();
  app.window.setHitTab('prob');
  const text = app.document.getElementById('hm-content').textContent;
  assert.match(text, /実績 2回/);
});
