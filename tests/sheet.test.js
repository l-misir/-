// スプレッドシートの列の整理（2026-10）: A 列（空欄）と AA〜AD（空欄4列）を無くし、当選履歴を最後の列に保存して復元できるようにする
// 新しい並び: A 日付, B 総回転数, C 通常時回転数, D ボーナス回転数, E BIG, F REG, G ベル, … Y レトロ発生,
//             Z 1枚掛けの計算, AA〜AS 詳細記録の19項目, AT 当選履歴（古い順「B120 R45[チェリー] B30[フリーズ・バイブ] R-」）
// 整理前の行（A 列が空欄、AE 列以降に詳細）も今までどおり読める
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

function captureSave(app) {
  let body = null;
  app.window.fetch = (url, opt) => {
    body = JSON.parse(opt.body);
    return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
  };
  app.ev(`data.gasUrl = 'https://example.invalid/exec';`);
  app.window.saveToSheet();
  return body;
}
// 新しい順の当選履歴（古い順に B120, R45[チェリー], B30[フリーズ・バイブ], R 未入力）
const HITS = [
  { g: null, k: 'r', trig: 'solo1', notice: 'normal', extras: [] },
  { g: 30, k: 'b', trig: 'solo1', notice: 'freeze', extras: ['vibe'] },
  { g: 45, k: 'r', trig: 'che', notice: 'normal', extras: [] },
  { g: 120, k: 'b', trig: 'solo1', notice: 'normal', extras: [] },
];
const HITS_TEXT = 'B120 R45[チェリー] B30[フリーズ・バイブ] R-';

function setupKing() {
  const app = loadApp();
  app.selectMachine('king');
  app.ev(`const d = getData(); d.start = { g: 0, b: 0, r: 0 };
    Object.assign(d.cur, { g: 1000, b: 2, r: 2, bell: 140, suika: 5, retro_d: 1, retro: 0 });
    d.hits = ${JSON.stringify(HITS)}; d.detail.nRep = 137; d.detail.lbSui = 1; save(true);`);
  return app;
}

test('シート保存: A 列と AA〜AD を無くした並び。Z が1枚掛けの計算、AA〜AS が詳細、AT が当選履歴', () => {
  const app = setupKing();
  const keys = JSON.parse(app.ev(`JSON.stringify(detailItems('king').map(x => x.k))`));
  const body = captureSave(app);
  const row = body.rowData;
  assert.equal(row.length, 25 + 1 + keys.length + 1, '46 列（A〜AT）');
  assert.match(String(row[0]), /^\d{4}\/\d{1,2}\/\d{1,2}$/, 'A は日付');
  // ボーナスは 20×2 + 10×2 + BIGスイカの欠損1（1回ごとに +1G）= 61
  assert.deepEqual(row.slice(1, 7), [1061, 1000, 61, 2, 2, 140], 'B 総回転数, C 通常時, D ボーナス, E BIG, F REG, G ベル');
  assert.equal(row[25], '予測値', 'Z は1枚掛けの計算');
  assert.equal(row[26], 137, 'AA から詳細（通常時リプレイ）');
  assert.equal(row[26 + keys.indexOf('lbSui')], 1);
  assert.equal(row[45], HITS_TEXT, 'AT は当選履歴（古い順）');
  assert.equal(body.headers.length, row.length);
  assert.equal(body.headers[0], '日付');
  assert.equal(body.headers[25], '1枚掛けの計算');
  assert.equal(body.headers[45], '当選履歴');
  assert.ok(!body.headers.some((h) => /黃/.test(h)), '見出しの「黃」は「黄」に');
  assert.ok(body.headers.includes('BIG筐体：黄'));
});

test('データコピー(TSV): シート保存と同じ並び', async () => {
  const app = setupKing();
  let txt = null;
  Object.defineProperty(app.window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { txt = t; return Promise.resolve(); } },
  });
  app.window.exportData();
  await new Promise((r) => setTimeout(r, 0));
  const body = captureSave(app);
  assert.deepEqual(txt.split('\t'), body.rowData.map(String));
});

test('当選履歴の文字列: 古い順、契機・告知は初期値以外だけ［］に。読み戻すと同じ記録になる', () => {
  const app = loadApp();
  assert.equal(app.ev(`hitsToText(${JSON.stringify(HITS)})`), HITS_TEXT);
  assert.equal(app.ev('hitsToText([])'), '');
  const back = JSON.parse(app.ev(`JSON.stringify(textToHits(${JSON.stringify(HITS_TEXT)}))`));
  assert.deepEqual(back, HITS);
  const odd = JSON.parse(app.ev(`JSON.stringify(textToHits('  B50[単独(後)・アメイジングチャンス・特殊テンパイ音]   xx R7 '))`));
  assert.deepEqual(odd, [
    { g: 7, k: 'r', trig: 'solo1', notice: 'normal', extras: [] },
    { g: 50, k: 'b', trig: 'solo2', notice: 'normal', extras: ['tenpai', 'ac'] },
  ], '読めない部分は飛ばす。付随は決まった順');
});

// 新しい並びの行（GAS は日付を文字列にして返す）
function newKingRow(app, { hits = '', oneBet = '予測値', detail = {} } = {}) {
  const keys = JSON.parse(app.ev(`JSON.stringify(detailItems('king').map(x => x.k))`));
  return [
    '2026/10/01 00:00', 1080, 1000, 80, 2, 2, 140, 5,
    1, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  1, 0,
    oneBet, ...keys.map((k) => (k in detail ? detail[k] : '')), hits,
  ];
}

test('実戦履歴: 新しい並びの行を読み、復元で当選履歴（契機・告知を含む）も戻す。レトロ達成は二重に足さない', async () => {
  const app = loadApp();
  app.selectMachine('king');
  app.window._historyRowsRaw = [{ sheet: 'キングハナハナ', row: 3, values: newKingRow(app, { hits: HITS_TEXT, detail: { nRep: 137 } }) }];
  await app.window.calculateAllHistoryRows();
  const r = app.window._historyRowsCalculated[0];
  assert.equal(r.spins, 1000);
  assert.equal(r.big, 2);
  assert.match(r.date, /^2026\/10\/01/, 'A 列の日付');
  app.window.restoreHistory(0);
  assert.deepEqual(JSON.parse(app.ev('JSON.stringify(getData().hits)')), HITS);
  assert.equal(app.ev('getData().cur.g'), 1000);
  assert.equal(app.ev('getData().cur.bell'), 140);
  assert.equal(app.ev('getData().cur.retro_d'), 1, 'シートのレトロ達成のまま（当選履歴から数え直して足さない）');
  assert.equal(app.ev('getData().detail.nRep'), 137);
  assert.equal(app.ev('getData().lamps.big[0]'), 1);
  // 復元後にタップしても、レトロ達成は差分だけ動く（今の当選履歴の数を基準にしている）
  assert.equal(app.ev('getData().retroAuto'), app.ev('retroAutoCount(getData().hits)'));
});

test('実戦履歴: 整理前の並び（A 列が空欄）の行も今までどおり読める', async () => {
  const app = loadApp();
  app.selectMachine('king');
  const old = ['', '2026/09/01 00:00', 1080, 1000, 80, 2, 2, 140, 5,
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, '設定4', 0.5, 100, '{}'];
  app.window._historyRowsRaw = [{ sheet: 'キングハナハナ', row: 3, values: old }];
  await app.window.calculateAllHistoryRows();
  const r = app.window._historyRowsCalculated[0];
  assert.deepEqual([r.spins, r.big, r.reg], [1000, 2, 2]);
  assert.match(r.date, /^2026\/09\/01/, 'B 列の日付');
  app.window.restoreHistory(0);
  assert.deepEqual(JSON.parse(app.ev('JSON.stringify(getData().hits)')), [], '整理前の行に当選履歴は無い');
  assert.equal(app.ev('getData().lamps.big[0]'), 1);
});

test('当選履歴の文字列: 大きすぎる数（壊れた値）は読み飛ばす。復元後に消しても G 数を壊さない', () => {
  const app = loadApp();
  const huge = 'B' + '9'.repeat(309);
  const hits = JSON.parse(app.ev(`JSON.stringify(textToHits(${JSON.stringify(huge + ' R10')}))`));
  assert.deepEqual(hits, [{ g: 10, k: 'r', trig: 'solo1', notice: 'normal', extras: [] }]);
  assert.deepEqual(JSON.parse(app.ev(`JSON.stringify(textToHits('B99999999999999999999'))`)), [], '安全な整数でなければ飛ばす');
});
