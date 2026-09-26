// 設定推測まわりの仕様テスト
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const bars = (app) =>
  [...app.document.querySelectorAll('#predict-bars .bar-val')].map((e) => e.textContent).join(' ');

test('合算(gas)の重みが総合推測に反映される', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`
    const d = getData(); d.start = {g:0,b:0,r:0}; d.hits = [];
    d.cur.g = 5000; d.cur.b = 18; d.cur.r = 14; d.cur.bell = 670;
    data.weights.newking.gas = 0; calc();
  `);
  const w0 = bars(app);
  app.ev('data.weights.newking.gas = 100; calc();');
  assert.notEqual(bars(app), w0);
});

test('信頼度ランク: 虹は最高設定の確定示唆がある時だけ', () => {
  const app = loadApp();
  assert.equal(app.ev('reliabilityRank(0.99, false)'), 5); // 確定示唆なしなら最高止まり
  assert.equal(app.ev('reliabilityRank(0.01, true)'), 6);
  assert.equal(app.ev('reliabilityRank(null, false)'), 0);
  assert.equal(app.ev('reliabilityRank(0.30, false)'), 3);
});

test('ニューキングⅤ: REG筐体ランプ紫で設定V確定扱い', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`
    const d = getData(); d.start = {g:0,b:0,r:0}; d.hits = [];
    d.cur.g = 3000; d.cur.b = 12; d.cur.r = 8;
    d.lamps.regT = [0,0,0,1]; calc();
  `);
  assert.equal(app.ev('lastCalcResult.maxConfirmed'), true);
  assert.equal(app.ev('lastCalcResult.settings[lastCalcResult.bestIdx]'), 'V');
});

test('ダミー表示: 内部値は変わらず、表示だけ置き換わる', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`const d = getData(); d.cur.g = 3000; d.cur.b = 12; d.cur.bell = 400;`);
  app.window.renderMain();
  app.window.toggleDummy();
  const vals = [...app.document.querySelectorAll('.value')].map((v) => v.textContent);
  assert.ok(vals.includes('3000'), 'G数は変化なしのはず');
  assert.ok(vals.includes('12'), 'BIGは変化なしのはず');
  assert.ok(vals.some((v) => v.length === 7 && v.slice(2, 5) === '400'), 'ベルは前後2桁ずつ付加');
  assert.equal(app.ev('getData().cur.bell'), 400);
  app.window.toggleDummy();
});
