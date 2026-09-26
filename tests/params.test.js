// 機種パラメータの整合性チェック
// 過去に「表示用 *_str だけ更新して計算用配列を更新し忘れる」事故が複数回起きたため、ここで機械的に検出する
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const { ev } = loadApp();
const P = ev('ALL_PARAMS');
const MACHINES = Object.keys(P);

// '(1/7.500)' → 7.5 / '(35.99%)' → 0.3599
const denomOf = (s) => {
  const m = String(s).match(/1\s*\/\s*([\d.]+)/);
  return m ? Number(m[1]) : NaN;
};
const pctOf = (s) => {
  const m = String(s).match(/([\d.]+)\s*%/);
  return m ? Number(m[1]) / 100 : NaN;
};
const close = (a, b, rel = 0.005) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * rel;

// 計算用キー → 表示用キー（gassan だけ名前がずれている）
const DENOM_PAIRS = [
  ['b', 'b_str'], ['r', 'r_str'], ['gassan', 'gas_str'], ['bell', 'bell_str'],
  ['suika', 'suika_str'], ['suikaR', 'suikaR_str'], ['blamp', 'blamp_str'], ['retro', 'retro_str'],
];

for (const m of MACHINES) {
  const p = P[m];
  const n = p.settings.length;

  test(`${m}: 1次元の分母配列と *_str が一致`, () => {
    for (const [calcKey, strKey] of DENOM_PAIRS) {
      if (!p[calcKey] || !p[strKey]) continue;
      assert.equal(p[calcKey].length, n, `${calcKey} の長さが設定数と違う`);
      p[calcKey].forEach((v, i) => {
        const shown = denomOf(p[strKey][i]);
        assert.ok(close(v, shown), `${calcKey}[${i}]=${v} と ${strKey}[${i}]=${p[strKey][i]} が不一致`);
      });
    }
  });

  // lampB は [設定][色] の確率、lampB_str は [色][設定] の '(1/N)'（転置）
  test(`${m}: lampB と lampB_str（転置）が一致`, () => {
    assert.equal(p.lampB.length, n);
    p.lampB.forEach((row, si) => {
      row.forEach((prob, ci) => {
        const shown = 1 / denomOf(p.lampB_str[ci][si]);
        assert.ok(close(prob, shown), `lampB[${si}][${ci}]=${prob} と lampB_str[${ci}][${si}] が不一致`);
      });
    });
  });

  // lampB の5色合計 = BIGランプ全体確率 1/blamp（直接確率である根拠。逐次抽選に変換しないこと）
  test(`${m}: lampB の行合計が 1/blamp と一致`, () => {
    p.lampB.forEach((row, si) => {
      const sum = row.reduce((a, b) => a + b, 0);
      assert.ok(close(sum, 1 / p.blamp[si], 0.01), `設定${p.settings[si]}: 合計 ${sum} vs 1/${p.blamp[si]}`);
    });
  });

  // sideR は [設定][色] の確率、sideR_str は [色][設定] の '(xx.xx%)'（転置）
  test(`${m}: sideR と sideR_str（転置）が一致し、各設定で合計100%`, () => {
    assert.equal(p.sideR.length, n);
    p.sideR.forEach((row, si) => {
      const sum = row.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 0.002, `設定${p.settings[si]} の sideR 合計が ${sum}`);
      row.forEach((prob, ci) => {
        const shown = pctOf(p.sideR_str[ci][si]);
        assert.ok(Math.abs(prob - shown) < 0.0006, `sideR[${si}][${ci}]=${prob} と sideR_str[${ci}][${si}] が不一致`);
      });
    });
  });

  test(`${m}: payout / highSetRateIdx が設定数と整合`, () => {
    assert.equal(p.payout.length, n);
    p.highSetRateIdx.forEach((i) => assert.ok(i >= 0 && i < n));
  });
}
