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

test('期待獲得枚数 = 総回転数（通常時＋ボーナス）× 0.03 ×（期待機械割 − 100）', () => {
  for (const m of ['newking', 'king']) {
    const app = loadApp();
    app.selectMachine(m);
    app.ev(`
      const d = getData(); d.start = {g:0,b:0,r:0}; d.hits = [];
      d.cur.g = 4000; d.cur.b = 16; d.cur.r = 12; d.cur.bell = 540;
      calc();
    `);
    const r = JSON.parse(app.ev('JSON.stringify(lastCalcResult)'));
    const pm = JSON.parse(app.ev(`JSON.stringify({ bigG: ALL_PARAMS.${m}.bigG, regG: ALL_PARAMS.${m}.regG })`));
    // 期待機械割: 1位の1/10未満の設定を除いて正規化した確率で機械割を加重平均（calc() と同じ）
    const max = Math.max(...r.pcts);
    const valid = r.pcts.map((p) => (p >= max / 10 ? p : 0));
    const sum = valid.reduce((a, b) => a + b, 0);
    const expRate = valid.reduce((a, p, i) => a + (p / sum) * r.payout[i], 0);
    const totalG = 4000 + 16 * pm.bigG + 12 * pm.regG;
    const expected = Math.round(totalG * 0.03 * (expRate - 100));
    const row = [...app.document.querySelectorAll('#expect-info .expect-row')]
      .find((e) => e.textContent.includes('期待獲得枚数'));
    assert.equal(Number(row.querySelector('.expect-val').textContent.replace(/[^-\d]/g, '')), expected, m);
  }
});

test('信頼度ランク: 虹は最高設定の確定示唆がある時だけ', () => {
  const app = loadApp();
  assert.equal(app.ev('reliabilityRank(0.99, false)'), 5); // 確定示唆なしなら最高止まり
  assert.equal(app.ev('reliabilityRank(0.01, true)'), 6);
  assert.equal(app.ev('reliabilityRank(null, false)'), 0);
  assert.equal(app.ev('reliabilityRank(0.30, false)'), 3);
});

test('信頼度ランクの境界: 最低<5% / 低5〜20% / 中20〜40% / 高40〜75% / 最高75%以上', () => {
  const app = loadApp();
  const r = (v) => app.ev(`RANK_LABELS[reliabilityRank(${v}, false)]`);
  assert.equal(r(0.0499), '最低');
  assert.equal(r(0.05), '低');
  assert.equal(r(0.1999), '低');
  assert.equal(r(0.20), '中');
  assert.equal(r(0.3999), '中');
  assert.equal(r(0.40), '高');
  assert.equal(r(0.7499), '高');
  assert.equal(r(0.75), '最高');
  assert.equal(r(1), '最高');
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
