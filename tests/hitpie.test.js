// 当選履歴の見直し（2026-10-04）:
//  - 緑の「前回の当たりから」の枠をやめ、今のハマりを一覧（メモリ）の先頭の行に出す
//  - 空いた左側に円グラフ（案C）: 全体＝BIG/REG の割合、BIG・REG＝先告知・後告知・小役重複。プレミアは外側の金の線の長さ
//    2026-10-06: 全体も BIG・REG と同じ作りに（扇は種別×契機、BIG は赤・REG は青の濃淡）。当たり1回ごとに円の中の場所を決め、
//    プレミアの線はその当たりの場所に出す（扇の中の金の長さ＝その扇の中のプレミアの割合）。扇の境目に細い線
//    プレミア＝告知がプレミア点滅・フリーズ、または備考（特殊テンパイ音・バイブ・バウンドストップ。ボタンを無くしたアメイジングチャンスの古い記録も）が付いた当選
//  - 備考（契機・告知）は棒の下の決まった高さの段に出し、備考の有無で行の高さを変えない
//  - 説明文は出さない
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

// hits は新しい順（先頭が最新）
const HITS = [
  { g: 50, k: 'r', trig: 'solo2', notice: 'normal', extras: ['vibe'] },  // REG 後告知・バイブ（プレミア）
  { g: 80, k: 'b', trig: 'solo1', notice: 'normal', extras: [] },        // BIG 先告知
  { g: 120, k: 'b', trig: 'solo1', notice: 'freeze', extras: [] },       // BIG 先告知・フリーズ（プレミア）
  { g: 30, k: 'r', trig: 'che', notice: 'normal', extras: [] },          // REG チェリー重複
  { g: 200, k: 'b', trig: 'solo2', notice: 'premium', extras: [] },      // BIG 後告知・プレミア点滅（プレミア）
];

function setup(hits = HITS, curG = 600) {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`const d = getData(); d.hits = ${JSON.stringify(hits)}; d.cur.g = ${curG}; d.cur.b = 3; d.cur.r = 2; calc();`);
  app.window.openHitModal();
  return app;
}
const content = (app) => app.document.getElementById('hm-content');
// 扇（種別×契機。例 b-pre）の回数。無い扇は 0
const seg = (app, k) => {
  const el = content(app).querySelector(`.hm-pie [data-seg="${k}"]`);
  return el ? Number(el.dataset.n) : 0;
};
const slices = (app) => [...content(app).querySelectorAll('.hm-pie circle[data-seg]')].map((e) => e.dataset.seg);
const prem = (app) => content(app).querySelector('.hm-pie [data-seg="premium"]');
// プレミアの線: どの扇の中に何回分あるか
const premIn = (app) => Object.fromEntries([...prem(app).querySelectorAll('[data-in]')].map((e) => [e.dataset.in, Number(e.dataset.n)]));
// 扇・線の範囲（0〜1。上から時計回り）
const span = (el) => {
  const C = 2 * Math.PI * Number(el.getAttribute('r'));
  const len = Number(el.getAttribute('stroke-dasharray').split(' ')[0]);
  const from = -Number(el.getAttribute('stroke-dashoffset'));
  return [from / C, (from + len) / C];
};
const near = (a, b) => Math.abs(a - b) < 1e-9;
const legend = (app) => content(app).querySelector('.hm-legend').textContent.replace(/\s+/g, ' ').trim();

test('今のハマりは一覧の先頭の行（メモリ付き）。緑の枠は出さない', () => {
  const app = setup(); // 記録の合計 480G、今 600G → 120G
  assert.equal(content(app).querySelector('.hm-now'), null, '緑の「前回の当たりから」の枠は無い');
  const list = content(app).querySelector('.hm-list');
  const first = list.firstElementChild;
  assert.ok(first.classList.contains('hm-cur'));
  assert.equal(first.querySelector('.hm-now-g').textContent, '120G');
  assert.equal(first.querySelectorAll('.hm-cell').length, 10, '当選の行と同じメモリ');
  assert.equal([...first.querySelectorAll('.hm-cell')].reduce((a, c) => a + Number(c.dataset.lit), 0), 12, '120G は12目盛り');
  assert.equal(first.querySelector('[onclick]'), null, '今のハマりは修正しない');
  assert.equal(list.querySelectorAll('.hm-row').length, 5, '当選の行はそのまま');
  // BIG で絞ると前回の BIG から（REG 50G + ハマり 120G）
  app.window.setHitListKind('b');
  assert.equal(content(app).querySelector('.hm-list > .hm-cur .hm-now-g').textContent, '170G');
});

test('記録が無くても今のハマりの行は出す', () => {
  const app = setup([], 75);
  assert.equal(content(app).querySelector('.hm-list > .hm-cur .hm-now-g').textContent, '75G');
  assert.match(content(app).textContent, /記録がありません/);
  assert.equal(content(app).querySelector('.hm-pie'), null, '円グラフは出さない');
});

test('円グラフ（全体）: BIG・REG のタブと同じく先告知・後告知・小役重複で分け、BIG は赤・REG は青の濃淡。割合の数字は今までどおり', () => {
  const app = setup();
  assert.deepEqual(slices(app), ['b-pre', 'b-post', 'r-post', 'r-dup'], 'BIG→REG、先告知→後告知→小役重複の順（0回の扇は無し）');
  assert.deepEqual(['b-pre', 'b-post', 'b-dup', 'r-pre', 'r-post', 'r-dup'].map((k) => seg(app, k)), [2, 1, 0, 0, 1, 1]);
  assert.equal(legend(app), 'BIG 60% REG 40% 後告知 40% 小役重複 20% プレミア 60%');
  assert.equal(content(app).querySelectorAll('.hm-pie line.hm-pie-sep').length, 4, '扇の境目に細い線');
  // 色は BIG・REG のタブと同じ
  const color = (k) => content(app).querySelector(`.hm-pie [data-seg="${k}"]`).getAttribute('stroke');
  const allColors = ['b-pre', 'b-post', 'r-post', 'r-dup'].map(color);
  app.window.setHitListKind('b');
  assert.deepEqual([color('b-pre'), color('b-post')], allColors.slice(0, 2));
  app.window.setHitListKind('r');
  assert.deepEqual([color('r-post'), color('r-dup')], allColors.slice(2));
  // 円グラフは左、回数・平均・最大・最小は右
  app.window.setHitListKind('all');
  const top = content(app).querySelector('.hm-top');
  assert.ok(top.firstElementChild.classList.contains('hm-pie'));
  assert.equal(top.querySelectorAll('.hm-stat-box').length, 4);
});

test('円グラフ: プレミアの線はその当たりの扇の中に出す（扇の中の金の長さ＝その扇の中のプレミアの割合）', () => {
  const app = setup();
  assert.equal(Number(prem(app).dataset.n), 3, 'プレミア点滅・フリーズ・バイブ');
  assert.deepEqual(premIn(app), { 'b-pre': 1, 'b-post': 1, 'r-post': 1 });
  // 1回 = 1/5。BIG先告知 [0, 0.4]（通常→プレミアの順なのでプレミアは後ろ半分）、BIG後告知 [0.4, 0.6]、REG後告知 [0.6, 0.8]、REG重複 [0.8, 1]
  const sl = (k) => span(content(app).querySelector(`.hm-pie [data-seg="${k}"]`));
  const pl = (k) => span(prem(app).querySelector(`[data-in="${k}"]`));
  [['b-pre', [0, 0.4]], ['b-post', [0.4, 0.6]], ['r-post', [0.6, 0.8]], ['r-dup', [0.8, 1]]].forEach(([k, [f, t]]) => {
    assert.ok(near(sl(k)[0], f) && near(sl(k)[1], t), `${k}: ${sl(k)}`);
  });
  [['b-pre', [0.2, 0.4]], ['b-post', [0.4, 0.6]], ['r-post', [0.6, 0.8]]].forEach(([k, [f, t]]) => {
    assert.ok(near(pl(k)[0], f) && near(pl(k)[1], t), `プレミア ${k}: ${pl(k)}`);
  });
});

test('円グラフ（BIG / REG）: 先告知・後告知・小役重複。プレミアの線もそれぞれの扇の中', () => {
  const app = setup();
  app.window.setHitListKind('b');
  assert.deepEqual(['b-pre', 'b-post', 'b-dup'].map((k) => seg(app, k)), [2, 1, 0]);
  assert.deepEqual(premIn(app), { 'b-pre': 1, 'b-post': 1 });
  assert.equal(legend(app), '先告知 67% 後告知 33% 小役重複 0% プレミア 67%');
  app.window.setHitListKind('r');
  assert.deepEqual(['r-pre', 'r-post', 'r-dup'].map((k) => seg(app, k)), [0, 1, 1]);
  assert.deepEqual(premIn(app), { 'r-post': 1 });
  assert.equal(legend(app), '先告知 0% 後告知 50% 小役重複 50% プレミア 50%');
});

test('円グラフ: 特殊テンパイ音・アメイジングチャンス（古い記録）もプレミア。契機の無い古い記録は先告知。扇が1つなら境目の線は無し', () => {
  const app = setup([
    { g: 10, k: 'b', extras: ['tenpai'] },
    { g: 10, k: 'b', trig: 'bell', notice: 'normal', extras: ['ac'] },
    { g: 10, k: 'b' },
    { g: 10, k: 'b', trig: 'rep', notice: 'normal', extras: [] },
  ]);
  app.window.setHitListKind('b');
  assert.deepEqual(['b-pre', 'b-post', 'b-dup'].map((k) => seg(app, k)), [2, 0, 2]);
  assert.deepEqual(premIn(app), { 'b-pre': 1, 'b-dup': 1 });
  const one = setup([{ g: 10, k: 'r', trig: 'solo1', notice: 'normal', extras: [] }]);
  assert.deepEqual(slices(one), ['r-pre']);
  assert.ok(near(span(one.document.querySelector('.hm-pie [data-seg="r-pre"]'))[1], 1), '1つなら円全体');
  assert.equal(one.document.querySelectorAll('.hm-pie line.hm-pie-sep').length, 0);
  assert.equal(Number(prem(one).dataset.n), 0);
});

test('一覧: 備考は棒の下の段に出す。備考が無い行にも同じ段があり、行の高さが変わらない', () => {
  const app = setup();
  const rows = [...content(app).querySelectorAll('.hm-row')];
  assert.ok(rows.every((r) => r.querySelector('.hm-mc > .hm-bar-wrap') && r.querySelector('.hm-mc > .hm-tagline')), '全部の行が同じ作り');
  assert.match(rows[0].querySelector('.hm-tagline').textContent, /単独\(後\)・バイブ/);
  assert.equal(rows[1].querySelector('.hm-tagline').textContent, '', '初期値だけの当選は空の段');
  assert.equal(rows[1].querySelector('.hm-tags'), null);
  const css = app.document.querySelector('style').textContent;
  assert.match(css, /\.hm-tagline\s*\{[^}]*height:\s*\d+px/, '段の高さは固定');
  assert.match(css, /\.hm-tagline\s*\{[^}]*white-space:\s*nowrap/, '長い備考も1行（はみ出しは …）');
});

test('説明文を出さない（当選履歴・確率表・テンキー・まとめて加算・管理画面）', async () => {
  const app = setup([{ g: null, k: 'b' }, { g: 100, k: 'r' }]);
  const text = () => content(app).textContent;
  assert.doesNotMatch(text(), /タップすると修正/);
  assert.doesNotMatch(text(), /未入力の記録が含まれています/);
  app.window.setHitTab('prob');
  assert.doesNotMatch(text(), /※/);
  app.window.setHitTab('rec');
  app.window.editHitG(0);
  assert.equal(app.document.querySelector('#hit-panel .hit-hint'), null, '「この当選の回転数を修正」');
  app.window.closeHitPanel();
  app.window.closeHitModal();
  await app.tap('#main-ui [data-id="b"]');
  assert.equal(app.document.querySelector('#hit-panel .hit-hint'), null, '「記録は既に作成済み…」');
  app.window.closeHitPanel();
  app.window.openBulkPanel();
  assert.equal(app.document.querySelector('#bulk-panel .hit-hint'), null, '「項目を選んで数を入力 → 加算」');
  app.window.closeBulkPanel();
  assert.equal(app.document.querySelector('#admin-modal .gas-note'), null, '「※ GASコードのTOKENと同じ…」');
  const empty = setup([], 0);
  assert.doesNotMatch(content(empty).textContent, /加算すると入力できます/);
});
