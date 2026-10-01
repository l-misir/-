// 段階4: 詳細記録を使った計算（docs/DETAIL_MODE_PLAN.md「計算」「1枚掛けとデータカウンター」「スプレッドシート」）
// 期待値は仕様書の式から手で計算した値
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

// キング: 通常時 1000G・BIG3・REG2・ベル140・BIGスイカ5（うち欠損1）
const KING = { g: 1000, b: 3, r: 2, bell: 140, suika: 5 };
const KING_DETAIL = {
  nRep: 137, nChe: 16, nCheM: 1, lnChe: 2, nSui: 10, lnSui: 1, lAlign: 2,
  oRep: 1, oBell: 1, bChe: 3, lbChe: 1, lbSui: 1, lrSui: 1, bMiss: 2, rMiss: 1,
};
// ニューキング: 通常時 1000G・BIG2・REG1・ベル130・BIG前半スイカ4（うち欠損1）・REGスイカ1（うち欠損1）
const NEWKING = { g: 1000, b: 2, r: 1, bell: 130, suika: 4, suikaR: 1 };
const NEWKING_DETAIL = {
  nRep: 140, nChe: 15, lnChe: 1, nSui: 12, lAlign: 1, bChe: 2, rChe: 1, btRep: 3, btBell: 4,
  lbChe: 1, lbSui: 1, lblSui: 1, lblBell: 2, lrSui: 1,
};

function setupMachine(m, cur, detail, oneBet = 'predict') {
  const app = loadApp();
  app.selectMachine(m);
  app.window.setOneBet(oneBet);
  app.ev(`const d = getData(); d.start = { g: 0, b: 0, r: 0 };
    Object.assign(d.cur, ${JSON.stringify(cur)}); Object.assign(d.detail, ${JSON.stringify(detail)}); save(true); calc();`);
  return app;
}
const stats = (app, m, oneBet) => JSON.parse(app.ev(`JSON.stringify(coinStats(getData(), '${m}', '${oneBet}'))`));
// 見出しと値の間に空白を入れて1行ずつつなぐ（「総回転数 1089 G | 現在獲得枚数 -176 枚 …」）
const expectText = (app) => [...app.document.querySelectorAll('#expect-info .expect-row')]
  .map((r) => [...r.children].map((e) => e.textContent.trim()).join(' ')).join(' | ').replace(/\s+/g, ' ');
const rowText = (app, id) => app.document.getElementById(`row-${id}`).textContent.replace(/\s+/g, ' ');

test('キング（1枚掛けの計算: 予測値）: 詳細の式で持ちコイン・欠損枚数・回転数を出す', () => {
  const app = setupMachine('king', KING, KING_DETAIL);
  const s = stats(app, 'king', 'predict');
  assert.equal(s.useDetail, true, '通常時リプレイが1以上');
  assert.equal(s.oneBetGames, 4, 'ボーナス揃えミス2 + 1枚掛けの小役2');
  assert.ok(Math.abs(s.effG - (1000 + 4 * 2 / 3)) < 1e-9, '分母 = カウンター + 1枚掛け × 2/3');
  assert.equal(s.bigGames, 64, '20×3 + BIGの欠損2 + 純ハズレ2');
  assert.equal(s.regGames, 22, '10×2 + REGスイカ欠損1 + 純ハズレ1');
  assert.equal(s.suiDenom, 64, 'BIGスイカの分母 = BIGのG数 + BIGの欠損 + BIG純ハズレ');
  // −3×1000 + 3×137 + 9×140 + 4×16 + 2×1 + 6×10 + 260×3 + 120×2 − (1×4 + 2×2) + (1×1 + 14×1)
  assert.equal(s.coins, -176);
  // 通常時: チェリー2×4 + 中段1×2 + スイカ1×6 + 揃えミス2×1 = 18、ボーナス中: 1×4 + 2×2 = 8
  assert.equal(s.loss, 26);
  const t = expectText(app);
  assert.match(t, /総回転数 1089 G/);
  assert.match(t, /現在獲得枚数 -176 枚/);
  assert.match(t, /現在獲得枚数 -176 枚 \(-26枚\)/, '欠損枚数を横に（「欠損」の文字は付けない）');
  assert.doesNotMatch(t, /欠損/);
  assert.match(rowText(app, 'b'), /\(1\/334\.22\)/, 'BIG の分母も1枚掛けの補正込み（1002.67 / 3）');
  assert.match(rowText(app, 'sui'), /5回.*\(1\/12\.80\).*\(1回\)/, 'スイカ 5/64、欠損1回は赤字');
});

test('キング（1枚掛けの計算: 実測値）: 1枚掛けのゲームごとに −1枚・+1回転', () => {
  const app = setupMachine('king', KING, KING_DETAIL, 'actual');
  const s = stats(app, 'king', 'actual');
  assert.equal(s.effG, 1004);
  assert.equal(s.coins, -180);
  assert.equal(s.loss, 26);
  const t = expectText(app);
  assert.match(t, /総回転数 1090 G/);
  assert.match(t, /現在獲得枚数 -180 枚/);
});

test('ニューキング: BT中ベル +12、ボーナス中の欠損はその区間の掛け枚数、スイカの分母は区間ごと', () => {
  const app = setupMachine('newking', NEWKING, NEWKING_DETAIL);
  const s = stats(app, 'newking', 'predict');
  assert.equal(s.oneBetGames, 0, 'ニューキングは3枚掛け固定（揃えミスは1枚掛けではない）');
  assert.equal(s.effG, 1000);
  assert.equal(s.bigGames, 64, '26×2 + BT中ベル4 + BT中リプレイ3 + BIG前半の欠損2 + BIG後半の欠損3');
  assert.equal(s.regGames, 11, '10×1 + REGの欠損1');
  assert.equal(s.suiDenom, 30, 'BIG(前半)スイカの分母 = 14×BIG + BIG前半の欠損');
  assert.equal(s.suiRDenom, 11, 'REGスイカの分母 = 10×REG + REGの欠損');
  // −3000 + 3×140 + 8×130 + 4×15 + 10×12 + 312×2 + 130×1 + 12×4 − (1×2 + 2×3 + 1×1)
  assert.equal(s.coins, -567);
  // 通常時: チェリー1×4 + 揃えミス1×3 = 7、ボーナス中: 9
  assert.equal(s.loss, 16);
  const t = expectText(app);
  assert.match(t, /総回転数 1075 G/);
  assert.match(t, /現在獲得枚数 -567 枚/);
  assert.match(t, /\(-16枚\)/);
  assert.match(rowText(app, 'sui'), /4回.*\(1\/7\.50\).*\(1回\)/);
  assert.match(rowText(app, 'suiR'), /1回.*\(1\/11\.00\).*\(1回\)/);
  assert.match(rowText(app, 'nrep'), /140回.*\(1\/7\.14\)/, '通常時リプレイの確率');
  assert.doesNotMatch(app.document.getElementById('detail-rows').textContent, /白\(不明\)/, '筐体ランプの白(不明)は出さない');
});

test('通常時リプレイが0なら今までの式（欠損は横に出すだけ）。回転数の +1 は効く', () => {
  const app = setupMachine('king', KING, { lnChe: 2, lbSui: 1 });
  const s = stats(app, 'king', 'predict');
  assert.equal(s.useDetail, false);
  const old = Math.round(app.ev('ALL_PARAMS.king.calcDiffReal(3, 2, 140, 1000)'));
  const t = expectText(app);
  assert.match(t, new RegExp(`現在獲得枚数 ${old} 枚`));
  assert.match(t, /\(-9枚\)/, 'チェリー2×4 + BIGスイカ1×1');
  assert.match(t, /総回転数 1081 G/, '1000 + 20×3 + 1 + 10×2');
});

test('詳細の式ではベル0の理論値補完をしない（今までの式では 500G 以上でベル0なら補う）', () => {
  const app = setupMachine('king', { g: 600, b: 0, r: 0, bell: 0, suika: 0 }, { nRep: 10 });
  assert.equal(stats(app, 'king', 'predict').coins, -1770); // −1800 + 3×10
  assert.match(expectText(app), /現在獲得枚数 -1770 枚/);
});

test('詳細を記録していなければ、今までと同じ（行も増えない）', () => {
  const app = setupMachine('king', KING, {});
  assert.equal(app.document.getElementById('row-nrep'), null);
  assert.doesNotMatch(expectText(app), /\(-\d+枚\)/);
  const old = Math.round(app.ev('ALL_PARAMS.king.calcDiffReal(3, 2, 140, 1000)'));
  assert.match(expectText(app), new RegExp(`現在獲得枚数 ${old} 枚`));
  assert.match(expectText(app), /総回転数 1080 G/);
});

test('設定「1枚掛けの計算」: 予測値／実測値。初期値は予測値。数値表示と同じ行', () => {
  const app = loadApp();
  assert.equal(app.ev('data.oneBet'), 'predict');
  assert.ok(app.document.getElementById('btn-onebet-predict').classList.contains('active-mode'));
  app.window.setOneBet('actual');
  assert.equal(app.ev('data.oneBet'), 'actual');
  assert.ok(app.document.getElementById('btn-onebet-actual').classList.contains('active-mode'));
  const pair = app.document.getElementById('btn-dummy-real').closest('.setting-pair');
  assert.ok(pair.querySelector('#btn-onebet-predict'), '数値表示と同じ行');
  const bad = loadApp({ storage: { oneBet: 'xxx' } });
  assert.equal(bad.ev('data.oneBet'), 'predict');
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

test('シート保存: Z 列に1枚掛けの計算、AA 列以降に詳細の項目。詳細を記録していない日は空欄（2026-10 の並び）', () => {
  const app = setupMachine('king', KING, KING_DETAIL, 'actual');
  const keys = JSON.parse(app.ev(`JSON.stringify(detailItems('king').map(x => x.k))`));
  const body = captureSave(app);
  assert.equal(body.rowData.length, 26 + keys.length + 1, 'A〜AT');
  assert.equal(body.rowData[25], '実測値');
  assert.deepEqual(body.rowData.slice(26, 26 + keys.length), keys.map((k) => KING_DETAIL[k] || 0), '記録した日は 0 も数字で');
  assert.equal(body.rowData[1], 1090, 'B 列の総回転数も同じ計算（実測値: 1004 + 64 + 22）');
  assert.equal(body.headers.length, body.rowData.length, '見出しも同じ列数');
  assert.equal(body.headers[25], '1枚掛けの計算');

  const none = setupMachine('king', KING, {});
  const b2 = captureSave(none);
  assert.equal(b2.rowData[25], '予測値');
  assert.ok(b2.rowData.slice(26, 26 + keys.length).every((v) => v === ''), '記録していない日は空欄（記録なし）');
});

// キングのシート1行（DATA_MODEL.md §3 の列順）。detail を渡すと AE 列以降も付ける
function kingRow(app, { g, b, r, bell, suika }, detail, oneBet) {
  const bonusG = b * 20 + r * 10;
  const base = [
    '', '2026/09/01', g + bonusG, g, bonusG, b, r, bell, suika,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    '', '', '', '',
  ];
  if (!detail) return base;
  const keys = JSON.parse(app.ev(`JSON.stringify(detailItems('king').map(x => x.k))`));
  return [...base, oneBet, ...keys.map((k) => detail[k] || 0)];
}

test('実戦履歴: 詳細の列がある行は設定推測と同じ計算で差枚を出し、復元で詳細と1枚掛けの計算も戻す', async () => {
  const app = loadApp();
  app.selectMachine('king');
  app.window._historyRowsRaw = [
    { sheet: 'キングハナハナ', row: 2, values: kingRow(app, KING, KING_DETAIL, '実測値') },
    { sheet: 'キングハナハナ', row: 3, values: kingRow(app, KING, null) },
  ];
  await app.window.calculateAllHistoryRows();
  const rows = app.window._historyRowsCalculated;
  assert.equal(rows[0].diff, -180, '詳細の式（実測値）');
  const old = Math.round(app.ev('ALL_PARAMS.king.calcDiffReal(3, 2, 140, 1000)'));
  assert.equal(rows[1].diff, old, '詳細の列が無い行は今までの式');
  assert.equal(app.ev('data.oneBet'), 'predict', '再計算では設定を変えない');

  app.window.restoreHistory(0);
  assert.equal(app.ev('getData().detail.nRep'), 137);
  assert.equal(app.ev('getData().detail.lbSui'), 1);
  assert.equal(app.ev('data.oneBet'), 'actual', '復元ではその日の1枚掛けの計算を使う');
});

test('実戦履歴の復元: AE 列の無い行（詳細記録より前）は1枚掛けの計算の設定を変えない', async () => {
  const app = loadApp();
  app.selectMachine('king');
  app.window.setOneBet('actual');
  app.window._historyRowsRaw = [{ sheet: 'キングハナハナ', row: 2, values: kingRow(app, KING, null) }];
  await app.window.calculateAllHistoryRows();
  app.window.restoreHistory(0);
  assert.equal(app.ev('data.oneBet'), 'actual');
  assert.equal(app.ev('getData().cur.g'), 1000);
});

// 詳細データの行（ユーザー指定の並び。2026-10）: 出現回数・出現確率・欠損回数（赤）を「◯回 (1/◯) (◯回)」で。
// 出現回数が0の小役と、その機種に無い欄は出さない。1・2枚掛けは回数だけ
const rowLabels = (app) => [...app.document.querySelectorAll('#detail-rows tr[id^="row-"] > th')].map((e) => e.textContent);
const rowVal = (app, id) => app.document.querySelector(`#row-${id} > td`).textContent.replace(/\s+/g, ' ').trim();

test('詳細データ（ニューキング）: 指定の並びで、回数・確率・欠損を出す', () => {
  const app = setupMachine('newking', NEWKING, NEWKING_DETAIL);
  assert.deepEqual(rowLabels(app), ['通常時回転数', 'BIG', 'REG', '合算',
    '通常時：リプレイ', '通常時：ベル', '通常時：チェリー', '通常時：スイカ',
    'BIG(前半)：チェリー', 'BIG(前半)：スイカ', 'BT：リプレイ', 'BT：ベル', 'REG：チェリー', 'REG：スイカ',
    'BIG(後半)：サイドランプ', 'BIG：筐体ランプ', 'REG：筐体ランプ', 'レトロサウンド']);
  assert.equal(rowVal(app, 'nche'), '16回 (1/62.50) (1回)', 'チェリー 15 + 欠損1、分母は通常時G 1000');
  assert.equal(rowVal(app, 'bche'), '3回 (1/10.00) (1回)', '分母は BIG前半の G数 30');
  assert.equal(rowVal(app, 'btrep'), '3回 (1/3.00)', 'BT のゲーム数 = リプレイ3 + ベル4 + BIG2（中段リプレイ）');
  assert.equal(rowVal(app, 'btbell'), '4回 (1/2.25)');
  assert.equal(rowVal(app, 'rche'), '1回 (1/11.00)', '欠損0回は出さない');
  assert.equal(app.document.querySelector('#row-nche .loss-txt').textContent, '(1回)', '欠損は赤字');
});

test('詳細データ（ニューキング以外）: 3枚掛けと1・2枚掛けを分け、1・2枚掛けは回数だけ。0回の小役は出さない', () => {
  const app = setupMachine('king', KING, KING_DETAIL);
  assert.deepEqual(rowLabels(app), ['通常時回転数', 'BIG', 'REG', '合算',
    '通常時：リプレイ（3）', '通常時：ベル（3）', '通常時：チェリー（3）', '通常時：スイカ（3）',
    '通常時：リプレイ（1・2）', '通常時：ベル（1・2）',
    'BIG：チェリー', 'BIG：スイカ', 'BIG：純ハズレ', 'REG：純ハズレ',
    'REG：サイドランプ', 'BIG：筐体ランプ', 'REG：筐体ランプ', 'レトロサウンド']);
  assert.equal(rowVal(app, 'orep'), '1回');
  assert.equal(rowVal(app, 'nche'), '19回 (1/52.77) (3回)', 'チェリー16 + 中段1 + 欠損2、欠損は欠損と中段の合計');
  assert.equal(rowVal(app, 'bmiss'), '2回 (1/32.00)', '分母は BIG のゲーム数 64');
  assert.equal(rowVal(app, 'rmiss'), '1回 (1/22.00)', '分母は REG のゲーム数 22');
});

test('詳細データ: 詳細を記録していない日は今の小役の行だけ（0回の小役は出さない）', () => {
  const app = setupMachine('king', { g: 1000, b: 3, r: 2, bell: 0, suika: 5 }, {});
  assert.deepEqual(rowLabels(app), ['通常時回転数', 'BIG', 'REG', '合算', 'BIG：スイカ',
    'REG：サイドランプ', 'BIG：筐体ランプ', 'REG：筐体ランプ', 'レトロサウンド']);
});
