// 保存データの読み込み・入力モード・実戦履歴（再計算と復元）
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

// ニューキングⅤのシート1行（DATA_MODEL.md §3 の列順）
function newkingRow({ g, b, r, bell }) {
  const bonusG = b * 26 + r * 10;
  return [
    '', '2026/09/01', g + bonusG, g, bonusG, b, r, bell,
    3, 1,               // スイカ BIG前半 / REG
    1, 1, 1, 1, 0,      // BIG後半サイド
    2, 1, 0, 0, 0,      // BIG筐体
    1, 0, 0, 0,         // REG筐体
    0, 0,               // レトロ
    '', '', '', '',
  ];
}

function setupCurrent(app) {
  app.selectMachine('newking');
  app.ev(`
    const d = getData();
    d.start = { g: 0, b: 0, r: 0 };
    d.cur.g = 1000; d.cur.b = 4; d.cur.r = 3; d.cur.bell = 111;
    d.hits = [{ g: 120, k: 'b' }];
    save(true);
  `);
}

const stored = (app) => JSON.parse(app.window.localStorage.getItem('hana_v20_data'));

test('実戦履歴の再計算中にタップしても、現在のデータは履歴行で上書きされない', async () => {
  const app = loadApp();
  setupCurrent(app);
  const rows = Array.from({ length: 10 }, (_, i) => ({
    sheet: 'ニューキングハナハナⅤ', row: i + 2,
    values: newkingRow({ g: 5000, b: 20, r: 15, bell: 680 }),
  }));
  app.window._historyRowsRaw = rows;

  // 10行目で await に入る。その間にベルをタップした想定
  const p = app.window.calculateAllHistoryRows();
  app.ev('getData().cur.bell += 1; save(true);');
  await p;

  assert.equal(app.ev('data.machine'), 'newking');
  assert.equal(app.ev('getData().cur.g'), 1000);
  assert.equal(app.ev('getData().cur.bell'), 112);
  const s = stored(app);
  assert.equal(s.newking.cur.g, 1000);
  assert.equal(s.newking.cur.bell, 112);
  assert.equal(app.window._historyRowsCalculated.length, 10);
  assert.equal(app.window._historyRowsCalculated[0].spins, 5000);
});

test('実戦履歴の復元: 復元前の当選履歴は引き継がない', async () => {
  const app = loadApp();
  setupCurrent(app);
  app.window._historyRowsRaw = [
    { sheet: 'ニューキングハナハナⅤ', row: 2, values: newkingRow({ g: 5000, b: 20, r: 15, bell: 680 }) },
  ];
  await app.window.calculateAllHistoryRows();
  app.window.restoreHistory(0);

  assert.equal(app.ev('JSON.stringify(getData().hits)'), '[]');
  assert.equal(app.ev('getData().cur.g'), 5000);
  assert.equal(app.ev('getData().cur.bell'), 680);
  assert.deepEqual(stored(app).newking.hits, []);
});

test('入力モード: G/BIG/REG は打ち始め値を下回らない', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`
    const d = getData();
    d.start = { g: 1000, b: 5, r: 3 };
    d.cur.g = 1500; d.cur.b = 7; d.cur.r = 4;
    setInputMode('input');
  `);
  const inputs = [...app.document.querySelectorAll('#main-ui .val-input')].slice(0, 3); // 現在の g, b, r
  inputs.forEach((el) => {
    el.value = '0';
    el.dispatchEvent(new app.window.Event('change'));
  });
  assert.equal(app.ev('JSON.stringify([getData().cur.g, getData().cur.b, getData().cur.r])'), '[1000,5,3]');
  assert.deepEqual(inputs.map((el) => el.value), ['1000', '5', '3']);
  const s = stored(app);
  assert.deepEqual([s.newking.cur.g, s.newking.cur.b, s.newking.cur.r], [1000, 5, 3]);
});

// 「全て」表示（2026-09 に廃止。古い保存データに viewMode:'total' が残っていても個人で扱う）: 打ち始め 1000G/B5/R3、現在 2000G/B9/R5、ベル133
function setupTotalView(app) {
  app.selectMachine('newking');
  app.ev(`
    data.viewMode = 'total';
    const d = getData();
    d.start = { g: 1000, b: 5, r: 3 };
    d.cur.g = 2000; d.cur.b = 9; d.cur.r = 5; d.cur.bell = 133;
  `);
}
// 個人の値: 通常時1000G / BIG4 / REG2 → ボーナス 4*26+2*10=124G、総回転 1124G
const PERSONAL = [1124, 1000, 124, 4, 2, 133];

test('シート保存: 「全て」表示でも自分が打った分（個人）の値で保存する', () => {
  const app = loadApp();
  setupTotalView(app);
  let body = null;
  app.window.fetch = (url, opt) => {
    body = JSON.parse(opt.body);
    return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
  };
  app.ev(`data.gasUrl = 'https://example.invalid/exec';`);
  app.window.saveToSheet();
  // rowData: ['', 日付, 総回転, 通常時, ボーナス, BIG, REG, ベル, ...]
  assert.deepEqual(body.rowData.slice(2, 8), PERSONAL);
  assert.equal(body.rowData.length, 30);
  assert.deepEqual(body.rowData.slice(26), ['', '', '', '']);
});

test('データコピー(TSV): 「全て」表示でも個人の値を出力する', async () => {
  const app = loadApp();
  setupTotalView(app);
  let txt = null;
  Object.defineProperty(app.window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { txt = t; return Promise.resolve(); } },
  });
  app.window.exportData();
  await new Promise((r) => setTimeout(r, 0));
  // TSV: 日付, 総回転, 通常時, ボーナス, BIG, REG, ベル, ...（A列と末尾4列なし）
  assert.deepEqual(txt.split('\t').slice(1, 7).map(Number), PERSONAL);
});

test('高設定期待度の帯: 切り捨てで判定し、100 は高設定以外の確率が0の日だけ', () => {
  const app = loadApp();
  // expectBand(高設定の確率, 高設定以外の確率)
  const band = (hi, lo = 1 - hi) => app.ev(`EXP_BANDS[expectBand(${hi}, ${lo})].label`);
  assert.equal(band(0), '0～10');
  assert.equal(band(0.109), '0～10');     // 10.9% は切り捨てで 10
  assert.equal(band(0.10999999999), '0～10'); // 境界直前も繰り上げない
  assert.equal(band(0.11), '11～30');
  assert.equal(band(0.309), '11～30');
  assert.equal(band(0.31), '31～50');
  assert.equal(band(0.509), '31～50');
  assert.equal(band(0.51), '51～80');
  assert.equal(band(0.809), '51～80');
  assert.equal(band(0.81), '81～99');
  assert.equal(band(0.9999), '81～99');   // 99.99% でも 100 ではない
  assert.equal(band(0.999999999995, 5e-12), '81～99'); // 100%未満はどれだけ近くても 81～99
  assert.equal(band(1, 1e-17), '81～99'); // 足すと 1 に丸まっても、高設定以外が残っていれば 81～99
  assert.equal(band(1, 0), '100');
  assert.equal(band(0.9999999999999999, 0), '100'); // 確定示唆で高設定以外が0なら、誤差があっても 100
});

test('高設定期待度の帯: 確定示唆（REG筐体 紫）の日は 100', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  const row = newkingRow({ g: 3000, b: 12, r: 8, bell: 400 });
  row[23] = 1; // REG筐体 紫
  app.window._historyRowsRaw = [{ sheet: 'ニューキングハナハナⅤ', row: 2, values: row }];
  await app.window.calculateAllHistoryRows();
  assert.equal(app.ev('EXP_BANDS[window._historyRowsCalculated[0].expBand].label'), '100');
});

test('実戦履歴の復元後、設定推測を閉じて戻った大当たり分布も復元後のデータで表示', async () => {
  const app = loadApp();
  setupCurrent(app); // 当選履歴 1件（120G）
  app.window.openHitModal();
  app.window.openModal('predict-modal');
  app.window._historyRowsRaw = [
    { sheet: 'ニューキングハナハナⅤ', row: 2, values: newkingRow({ g: 5000, b: 20, r: 15, bell: 680 }) },
  ];
  await app.window.calculateAllHistoryRows();
  app.window.restoreHistory(0);
  app.window.closeModal('predict-modal'); // ✕ で大当たり分布へ戻る
  const text = app.document.getElementById('hm-content').textContent;
  assert.match(text, /記録がありません/);
  assert.match(app.document.querySelector('.hm-now-g').textContent, /^5000G/);
});

// 信頼度ランク・高設定期待度の帯を指定した履歴行
function histRow(i, { rel, maxConfirmed = false, setting, band }) {
  return {
    sheet: 'ニューキングハナハナⅤ', rowNum: i + 2, machineId: 'newking', machineName: 'ニューキングハナハナⅤ',
    date: `2026/9/${i + 1}`, spins: 3000, big: 10, reg: 10,
    predictedSetting: setting, highSettingProb: '', expBand: band,
    reliability: rel, maxConfirmed, diff: 0, rawValues: [],
  };
}

test('実戦履歴のフィルタ: 押したランク/帯だけを表示し、初期値は全部ON', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window._historyRowsCalculated = [
    histRow(0, { rel: 0.03, setting: '設定4', band: 4 }), // 最低・81～99
    histRow(1, { rel: 0.03, setting: '設定5', band: 4 }), // 最低・81～99
    histRow(2, { rel: 0.30, setting: '設定1', band: 0 }), // 中・0～10
    histRow(3, { rel: 0.90, setting: '設定V', band: 5, maxConfirmed: true }), // 虹・100
  ];
  app.window.renderHistFilters();
  app.window.renderHistory();
  const count = () => app.document.getElementById('hist-count').textContent;
  const active = (sel) => [...app.document.querySelectorAll(`${sel} .hist-filter-btn.active`)].length;
  assert.equal(active('#rel-filter'), 6);
  assert.equal(active('#exp-filter'), 6);
  assert.equal(count(), '表示4件 / 全4件');

  // 最低 だけ残す → 最低の2件だけ（「最低以上」ではない）
  [2, 3, 4, 5, 6].forEach((r) => app.window.toggleRelFilter(r));
  assert.equal(count(), '表示2件 / 全4件');

  // 信頼度を全部戻し、期待度 81～99 を外す → 最低の2件が消える
  [2, 3, 4, 5, 6].forEach((r) => app.window.toggleRelFilter(r));
  app.window.toggleExpFilter(4);
  assert.equal(count(), '表示2件 / 全4件');
  assert.equal(active('#exp-filter'), 5);
});

test('設定ツモ率の棒: 高設定期待度の帯ごとに色分けして積む', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window._historyRowsCalculated = [
    histRow(0, { rel: 0.05, setting: '設定4', band: 4 }),
    histRow(1, { rel: 0.05, setting: '設定4', band: 3 }),
    histRow(2, { rel: 0.30, setting: '設定4', band: 4 }),
  ];
  app.window.renderHistFilters();
  app.window.renderHistory();
  const segs = [...app.document.querySelectorAll('#hist-summary .bar-seg')].map((s) => s.style.flex.split(' ')[0]);
  assert.deepEqual(segs, ['1', '2']); // 51～80 が1件、81～99 が2件（低い帯から左）
  assert.match(app.document.querySelector('#hist-summary .bar-val').textContent, /100\.0% \(3回\)/);
});

test('古い保存データ: 機種データ内の欠けたキーを補完する', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`
    const d = getData();
    d.cur.g = 3000; d.cur.b = 12; d.cur.r = 8; d.cur.bell = 400;
    delete d.cur.suikaR;        // suikaR 追加前の保存データ
    d.lamps.regT = [1, 0, 0];   // 配列が短い
    delete d.morning;
    save(true);
    data = loadData();
  `);
  assert.equal(app.ev('getData().cur.suikaR'), 0);
  assert.equal(app.ev('getData().cur.bell'), 400); // 既存値は保持
  assert.equal(app.ev('JSON.stringify(getData().lamps.regT)'), '[1,0,0,0,0]');
  assert.equal(app.ev('getData().morning'), -1);
  app.ev('calc()');
  const text = app.document.getElementById('predict-bars').textContent;
  assert.doesNotMatch(text, /NaN/);
});
