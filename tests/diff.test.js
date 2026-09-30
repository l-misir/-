// 現在獲得枚数（calcDiffReal）の実機キャリブレーション回帰テスト
// 実データは docs/CALIBRATION.md を参照。許容誤差は ±70枚（実機グラフの目視読み取り誤差込み）
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const CASES = [
  { m: 'dragon', name: 'ドラハナ①', G: 10595, B: 46, R: 14, BELL: 1485, real: 0 },
  { m: 'dragon', name: 'ドラハナ②', G: 7768, B: 32, R: 15, BELL: 1103, real: 50 },
  { m: 'dragon', name: 'ドラハナ③', G: 10637, B: 41, R: 29, BELL: 1521, real: 350 },
  { m: 'king', name: 'キンハナ', G: 10495, B: 48, R: 18, BELL: 1448, real: 1571 },
];
const TOLERANCE = 70;

const app = loadApp();
for (const c of CASES) {
  test(`${c.name}: 実機差枚 ${c.real} に ±${TOLERANCE} 以内`, () => {
    app.selectMachine(c.m);
    app.ev(`
      const d = getData();
      d.start = { g:0, b:0, r:0 }; d.hits = [];
      d.cur.g = ${c.G}; d.cur.b = ${c.B}; d.cur.r = ${c.R}; d.cur.bell = ${c.BELL};
      d.cur.suika = 0; d.cur.suikaR = 0; d.cur.retro_d = 0; d.cur.retro = 0;
      d.lamps = { big:[0,0,0,0,0], regS:[0,0,0,0,0], regT:[0,0,0,0,0] };
      d.morning = -1;
      calc();
    `);
    const text = app.document.getElementById('expect-info').textContent;
    const m = text.match(/現在獲得枚数([+-]?\d+)\s*枚/);
    assert.ok(m, '現在獲得枚数が表示されていない');
    const shown = Number(m[1]);
    assert.ok(Math.abs(shown - c.real) <= TOLERANCE, `表示 ${shown} / 実機 ${c.real}`);
  });
}
