// スプレッドシートの列（2026-10 ユーザー指定の並び。docs/DATA_MODEL.md §3）。1行目は空、2行目が見出し、3行目からデータ。
// 列の定義は sheetColumns(m) の1か所。保存・TSV・読み込み・復元はすべてそこから作る。
// 整理前の並びの行（A 列が空欄、B 日付 … Z レトロ発生、AE 以降に詳細）も今までどおり読める
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const headers = (app, m) => JSON.parse(app.ev(`JSON.stringify(sheetColumns('${m}').map(c => c.h))`));

// ユーザー指定のニューキングの並び（＋「通常時：スイカ(欠損)」と「当選履歴」。「黃」は「黄」）
const NEWKING_HEADERS = ['日付', '総回転数', '通常時回転数', 'BIG：回転数', 'REG：回転数', 'BIG', 'REG',
  '通常時：リプレイ', '通常時：ベル', '通常時：チェリー', '通常時：チェリー(欠損)', '通常時：中段チェリー(欠損)',
  '通常時：スイカ', '通常時：スイカ(欠損)', '通常時：ボーナス(欠損)',
  'BIG前半：チェリー', 'BIG前半：チェリー(欠損)', 'BIG前半：スイカ', 'BIG前半：スイカ(欠損)',
  'BT：リプレイ', 'BT：ベル', 'BIG後半：スイカ(欠損)', 'BIG後半：ベル(欠損)',
  'REG：チェリー', 'REG：チェリー(欠損)', 'REG：スイカ', 'REG：スイカ(欠損)',
  'BIG後半：サイド(青)', 'BIG後半：サイド(黄)', 'BIG後半：サイド(緑)', 'BIG後半：サイド(赤)', 'BIG後半：サイド(虹)',
  'BIG：筐体ランプ(白)', 'BIG：筐体ランプ(青)', 'BIG：筐体ランプ(黄)', 'BIG：筐体ランプ(緑)', 'BIG：筐体ランプ(紫)', 'BIG：筐体ランプ(虹)',
  'REG：筐体ランプ(白)', 'REG：筐体ランプ(青)', 'REG：筐体ランプ(黄)', 'REG：筐体ランプ(緑)', 'REG：筐体ランプ(紫)',
  'レトロ達成', 'レトロ発生', '当選履歴'];
// ニューキング以外（ユーザーに確認した案）
const OTHER_HEADERS = ['日付', '総回転数', '通常時回転数', 'BIG：回転数', 'REG：回転数', 'BIG', 'REG',
  '通常時：リプレイ', '通常時：ベル', '通常時：チェリー', '通常時：チェリー(欠損)', '通常時：中段チェリー(欠損)',
  '通常時：スイカ', '通常時：スイカ(欠損)',
  '1・2枚掛け：リプレイ', '1・2枚掛け：ベル', '1・2枚掛け：チェリー', '1・2枚掛け：スイカ', '1・2枚掛け：ボーナス(欠損)',
  'BIG：チェリー', 'BIG：チェリー(欠損)', 'BIG：スイカ', 'BIG：スイカ(欠損)', 'BIG：純ハズレ',
  'REG：スイカ(欠損)', 'REG：純ハズレ',
  'REG：サイド(青)', 'REG：サイド(黄)', 'REG：サイド(緑)', 'REG：サイド(赤)', 'REG：サイド(虹)',
  'BIG：筐体ランプ(白)', 'BIG：筐体ランプ(青)', 'BIG：筐体ランプ(黄)', 'BIG：筐体ランプ(緑)', 'BIG：筐体ランプ(赤)', 'BIG：筐体ランプ(虹)',
  'REG：筐体ランプ(白)', 'REG：筐体ランプ(青)', 'REG：筐体ランプ(黄)', 'REG：筐体ランプ(緑)', 'REG：筐体ランプ(赤)', 'REG：筐体ランプ(虹)',
  'レトロ達成', 'レトロ発生', '1枚掛けの計算', '当選履歴'];

test('列の並び: ニューキングはユーザー指定どおり、それ以外は確認した案。詳細記録の項目はどれも1回ずつ', () => {
  const app = loadApp();
  assert.deepEqual(headers(app, 'newking'), NEWKING_HEADERS);
  for (const m of ['houou', 'king', 'dragon', 'star']) assert.deepEqual(headers(app, m), OTHER_HEADERS, m);
  for (const m of ['newking', 'king']) {
    const keys = JSON.parse(app.ev(`JSON.stringify(sheetColumns('${m}').filter(c => c.t === 'detail').map(c => c.k))`));
    const items = JSON.parse(app.ev(`JSON.stringify(detailItems('${m}').map(x => x.k))`));
    assert.deepEqual([...keys].sort(), [...items].sort(), `${m}: 詳細記録の全項目`);
  }
});

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

function setupNewking() {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`const d = getData(); d.start = { g: 0, b: 0, r: 0 };
    Object.assign(d.cur, { g: 1000, b: 2, r: 1, bell: 130, suika: 4, suikaR: 1, retro_d: 1, retro: 0 });
    d.lamps.regS = [1, 0, 0, 0, 0]; d.lamps.big = [0, 1, 0, 0, 0]; d.lamps.regT = [0, 0, 1, 0, 0];
    d.hits = ${JSON.stringify(HITS)};
    Object.assign(d.detail, { nRep: 140, nChe: 15, lnChe: 1, nSui: 12, lbSui: 1, btRep: 3, btBell: 4, lrSui: 1, wBig: 1 });
    save(true);`);
  return app;
}

test('シート保存（ニューキング）: 列の定義どおりの値。取得の列は合計 − 欠損、当選履歴は最後', () => {
  const app = setupNewking();
  const body = captureSave(app);
  const row = body.rowData;
  assert.deepEqual(body.headers, NEWKING_HEADERS);
  const val = (h) => row[NEWKING_HEADERS.indexOf(h)];
  assert.equal(row.length, NEWKING_HEADERS.length);
  assert.match(String(val('日付')), /^\d{4}\/\d{1,2}\/\d{1,2}$/);
  assert.equal(val('通常時回転数'), 1000);
  // BIG: 26×2 + BT中リプレイ3 + BT中ベル4 + BIG前半スイカの欠損1 = 60、REG: 10×1 + REGスイカの欠損1 = 11
  assert.equal(val('BIG：回転数'), 60);
  assert.equal(val('REG：回転数'), 11);
  assert.equal(val('総回転数'), 1071);
  assert.deepEqual([val('BIG'), val('REG'), val('通常時：ベル')], [2, 1, 130]);
  assert.equal(val('通常時：リプレイ'), 140);
  assert.equal(val('BIG前半：スイカ'), 3, '取得 = 合計4 − 欠損1');
  assert.equal(val('BIG前半：スイカ(欠損)'), 1);
  assert.equal(val('REG：スイカ'), 0, '取得 = 合計1 − 欠損1');
  assert.equal(val('BIG前半：チェリー'), 0, '詳細を記録している日は 0 も数字で');
  assert.equal(val('BIG後半：サイド(青)'), 1);
  assert.equal(val('BIG：筐体ランプ(白)'), 1);
  assert.equal(val('BIG：筐体ランプ(黄)'), 1);
  assert.equal(val('REG：筐体ランプ(緑)'), 1);
  assert.equal(val('レトロ達成'), 1);
  assert.equal(val('当選履歴'), HITS_TEXT);
});

test('シート保存（ニューキング以外）: 詳細を記録していない日は詳細の列が空欄。1枚掛けの計算も保存', () => {
  const app = loadApp();
  app.selectMachine('king');
  app.window.setOneBet('actual');
  app.ev(`const d = getData(); d.start = { g: 0, b: 0, r: 0 }; Object.assign(d.cur, { g: 500, b: 1, r: 1, bell: 70, suika: 2 }); save(true);`);
  const body = captureSave(app);
  const val = (h) => body.rowData[OTHER_HEADERS.indexOf(h)];
  assert.deepEqual(body.headers, OTHER_HEADERS);
  assert.deepEqual([val('BIG：回転数'), val('REG：回転数'), val('総回転数')], [20, 10, 530]);
  assert.equal(val('BIG：スイカ'), 2, '取得（欠損 0）');
  assert.equal(val('BIG：スイカ(欠損)'), '', '記録していない日は空欄');
  assert.equal(val('通常時：リプレイ'), '');
  assert.equal(val('1枚掛けの計算'), '実測値');
  assert.equal(val('当選履歴'), '');
});

test('データコピー(TSV): シート保存と同じ並び', async () => {
  const app = setupNewking();
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
  assert.deepEqual(JSON.parse(app.ev(`JSON.stringify(textToHits(${JSON.stringify(HITS_TEXT)}))`)), HITS);
  const odd = JSON.parse(app.ev(`JSON.stringify(textToHits('  B50[単独(後)・アメイジングチャンス・特殊テンパイ音]   xx R7 '))`));
  assert.deepEqual(odd, [
    { g: 7, k: 'r', trig: 'solo1', notice: 'normal', extras: [] },
    { g: 50, k: 'b', trig: 'solo2', notice: 'normal', extras: ['tenpai', 'ac'] },
  ], '読めない部分は飛ばす。付随は決まった順');
});

test('当選履歴の文字列: 大きすぎる数（壊れた値）は読み飛ばす', () => {
  const app = loadApp();
  const huge = 'B' + '9'.repeat(309);
  assert.deepEqual(JSON.parse(app.ev(`JSON.stringify(textToHits(${JSON.stringify(huge + ' R10')}))`)),
    [{ g: 10, k: 'r', trig: 'solo1', notice: 'normal', extras: [] }]);
  assert.deepEqual(JSON.parse(app.ev(`JSON.stringify(textToHits('B99999999999999999999'))`)), [], '安全な整数でなければ飛ばす');
});

test('実戦履歴: 新しい並びの行を読み、復元で詳細・取得と欠損・ランプ・当選履歴・1枚掛けの計算を戻す', async () => {
  const src = setupNewking();
  const saved = captureSave(src).rowData.map((x, i) => (i === 0 ? '2026/10/01 00:00' : x)); // GAS は日付を文字列にして返す
  const app = loadApp();
  app.selectMachine('newking');
  app.window._historyRowsRaw = [{ sheet: 'ニューキングハナハナⅤ', row: 3, values: saved }];
  await app.window.calculateAllHistoryRows();
  const r = app.window._historyRowsCalculated[0];
  assert.deepEqual([r.spins, r.big, r.reg], [1000, 2, 1]);
  assert.match(r.date, /^2026\/10\/01/);
  app.window.restoreHistory(0);
  const d = JSON.parse(app.ev('JSON.stringify(getData())'));
  assert.deepEqual([d.cur.g, d.cur.b, d.cur.r, d.cur.bell, d.cur.suika, d.cur.suikaR], [1000, 2, 1, 130, 4, 1], '取得 + 欠損 = 合計');
  assert.deepEqual([d.detail.nRep, d.detail.lbSui, d.detail.lrSui, d.detail.btBell, d.detail.wBig], [140, 1, 1, 4, 1]);
  assert.deepEqual([d.lamps.regS[0], d.lamps.big[1], d.lamps.regT[2]], [1, 1, 1]);
  assert.deepEqual(d.hits, HITS);
  assert.equal(d.cur.retro_d, 1, 'シートのレトロ達成のまま（当選履歴から数え直して足さない）');
  assert.equal(d.retroAuto, app.ev('retroAutoCount(getData().hits)'));

  const king = loadApp();
  king.selectMachine('king');
  const vals = { 日付: '2026/10/02 00:00', 総回転数: 530, 通常時回転数: 500, 'BIG：回転数': 20, 'REG：回転数': 10,
    BIG: 1, REG: 1, '1枚掛けの計算': '実測値', 'BIG：スイカ': 2 };
  const row = OTHER_HEADERS.map((h) => (h in vals ? vals[h] : ''));
  king.window._historyRowsRaw = [{ sheet: 'キングハナハナ', row: 3, values: row }];
  await king.window.calculateAllHistoryRows();
  king.window.restoreHistory(0);
  assert.equal(king.ev('data.oneBet'), 'actual');
  assert.equal(king.ev('getData().cur.suika'), 2);
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
  assert.match(r.date, /^2026\/09\/01/);
  app.window.restoreHistory(0);
  assert.deepEqual(JSON.parse(app.ev('JSON.stringify(getData().hits)')), [], '整理前の行に当選履歴は無い');
  assert.equal(app.ev('getData().lamps.big[0]'), 1);
  assert.equal(app.ev('getData().cur.suika'), 5);
});

test('実戦履歴: 欠損の列に不正な値（マイナス・文字）があっても、取得の回数を失わない', async () => {
  const app = loadApp();
  app.selectMachine('king');
  const vals = { 日付: '2026/10/03 00:00', 総回転数: 530, 通常時回転数: 500, 'BIG：回転数': 20, 'REG：回転数': 10,
    BIG: 1, REG: 1, 'BIG：スイカ': 2, 'BIG：スイカ(欠損)': -3, '通常時：スイカ(欠損)': 'x' };
  const row = OTHER_HEADERS.map((h) => (h in vals ? vals[h] : ''));
  app.window._historyRowsRaw = [{ sheet: 'キングハナハナ', row: 3, values: row }];
  await app.window.calculateAllHistoryRows();
  app.window.restoreHistory(0);
  assert.equal(app.ev('getData().cur.suika'), 2, '取得 2 + 欠損（不正なので 0）');
  assert.equal(app.ev('getData().detail.lbSui'), 0);
  assert.equal(app.ev('getData().detail.lnSui'), 0);
});
