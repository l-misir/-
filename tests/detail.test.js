// 段階2: 詳細小役記録のデータの持ち方（docs/DETAIL_MODE_PLAN.md「持ち方」）
// 今の項目（cur.bell / cur.suika / cur.suikaR / lamps）を合計として正にし、詳細にしか無い値だけを md.detail に持つ
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const MACHINES = ['houou', 'king', 'dragon', 'star', 'newking'];
const stored = (app) => JSON.parse(app.window.localStorage.getItem('hana_v20_data'));
const detail = (app, m) => JSON.parse(app.ev(`JSON.stringify(data.${m}.detail)`));
const itemKeys = (app, m) => JSON.parse(app.ev(`JSON.stringify(detailItems('${m}').map(x => x.k))`));

test('詳細記録: 設定の初期値は OFF。全機種の機種データに、その機種の詳細の値（全部0）を持つ', () => {
  const app = loadApp();
  assert.equal(app.ev('data.detailMode'), false);
  for (const m of MACHINES) {
    const det = detail(app, m);
    const keys = itemKeys(app, m);
    assert.ok(keys.length > 0);
    keys.forEach((k) => assert.equal(det[k], 0, `${m}.${k}`));
  }
  // 機種ごとの項目（DETAIL_MODE_PLAN.md「詳細記録の項目」）
  assert.ok(itemKeys(app, 'newking').includes('btBell'), 'ニューキングは BT中ベル');
  assert.ok(!itemKeys(app, 'newking').includes('oRep'), 'ニューキングに1枚掛けは無い');
  assert.ok(itemKeys(app, 'king').includes('oRep'), 'ニューキング以外は1枚掛け');
  assert.ok(!itemKeys(app, 'king').includes('btBell'));
});

test('古い保存データ（詳細の値なし・壊れた値）: 0 で補い、今の値は変えない。欠損は合計を超えない', () => {
  const app = loadApp({
    storage: {
      machine: 'king', detailMode: 'yes',
      king: { cur: { g: 1000, bell: 50, suika: 3 } },
      newking: { cur: { suika: 2, suikaR: 1 }, detail: { nRep: 12, lbSui: 5, lrSui: -3, btBell: 'x', nChe: 2.7 } },
    },
  });
  assert.equal(app.ev('data.detailMode'), false, 'boolean でなければ初期値');
  const k = detail(app, 'king');
  itemKeys(app, 'king').forEach((key) => assert.equal(k[key], 0));
  assert.equal(app.ev('data.king.cur.bell'), 50);
  assert.equal(app.ev('data.king.cur.suika'), 3);
  const n = detail(app, 'newking');
  assert.equal(n.nRep, 12, '記録済みの値は残す');
  assert.equal(n.lbSui, 2, 'BIG(前半)スイカの欠損は合計（cur.suika = 2）まで');
  assert.equal(n.lrSui, 0, 'マイナスは 0');
  assert.equal(n.btBell, 0, '数でなければ 0');
  assert.equal(n.nChe, 2, '整数にする');
});

test('今の画面（タップ）で合計を減らして欠損を下回るときは、欠損も一緒に減らす', async () => {
  const app = loadApp();
  app.selectMachine('king');
  app.ev('const d = getData(); d.cur.suika = 3; d.detail.lbSui = 3; d.detail.lrSui = 2; renderMain();');
  await app.tap('#main-ui [data-id="suika"]', { long: true }); // 3 → 2
  assert.equal(app.ev('getData().cur.suika'), 2);
  assert.equal(app.ev('getData().detail.lbSui'), 2, 'BIGスイカの欠損も 2 に');
  assert.equal(app.ev('getData().detail.lrSui'), 2, 'REGスイカの欠損（ニューキング以外は今の合計に含まれない）は変えない');
  assert.equal(stored(app).king.detail.lbSui, 2, '保存データも');
  await app.tap('#main-ui [data-id="suika"]'); // 増やしても欠損は増えない
  assert.equal(app.ev('getData().detail.lbSui'), 2);
});

test('ニューキング: 入力モードで BIG(前半)スイカ・REGスイカの合計を減らすと、その欠損も減る（上回っていれば変えない）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('const d = getData(); d.cur.suika = 4; d.cur.suikaR = 2; d.detail.lbSui = 3; d.detail.lrSui = 2;');
  app.window.setInputMode('input');
  const input = (id) => app.document.querySelector(`#main-ui [data-id="${id}"] input`);
  input('suikaR').value = '1';
  input('suikaR').dispatchEvent(new app.window.Event('change'));
  assert.equal(app.ev('getData().detail.lrSui'), 1);
  input('suika').value = '3';
  input('suika').dispatchEvent(new app.window.Event('change'));
  assert.equal(app.ev('getData().detail.lbSui'), 3, '合計 3 = 欠損 3 なのでそのまま');
});

test('詳細の値があっても、今の設定推測・現在獲得枚数は変わらない（段階2はデータだけ）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('const d = getData(); d.cur.g = 3000; d.cur.b = 12; d.cur.r = 9; d.cur.bell = 400; d.cur.suika = 5; d.cur.suikaR = 2; calc();');
  const before = app.document.getElementById('detail-rows').textContent + app.document.getElementById('expect-info').textContent;
  app.ev('const d = getData(); Object.assign(d.detail, { nRep: 400, nChe: 60, lbSui: 2, lrSui: 1, btBell: 5, wBig: 3 }); calc();');
  const after = app.document.getElementById('detail-rows').textContent + app.document.getElementById('expect-info').textContent;
  assert.equal(after, before);
});

test('詳細の値は保存・再読込で残り、リセット・シートからの復元では 0 になる', () => {
  const app = loadApp();
  app.selectMachine('king');
  app.ev('getData().detail.nRep = 7; getData().detail.oBell = 2; save(true);');
  const reloaded = loadApp({ storage: stored(app) });
  assert.equal(reloaded.ev('data.king.detail.nRep'), 7);
  assert.equal(reloaded.ev('data.king.detail.oBell'), 2);
  reloaded.window.resetAll();
  assert.equal(reloaded.ev('data.king.detail.nRep'), 0);
  const fromRow = JSON.parse(reloaded.ev(`JSON.stringify(machineDataFromRow('king', []).detail)`));
  itemKeys(reloaded, 'king').forEach((k) => assert.equal(fromRow[k], 0));
});
