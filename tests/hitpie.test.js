// 当選履歴の見直し（2026-10-04）:
//  - 緑の「前回の当たりから」の枠をやめ、今のハマりを一覧（メモリ）の先頭の行に出す
//  - 空いた左側に円グラフ（案C）: 全体＝BIG/REG の割合、BIG・REG＝先告知・後告知・小役重複。プレミアは外側の金の線の長さ
//    プレミア＝告知がプレミア点滅・フリーズ、または備考（特殊テンパイ音・バイブ・アメイジングチャンス）が付いた当選
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
const seg = (app, k) => {
  const el = content(app).querySelector(`.hm-pie [data-seg="${k}"]`);
  return el ? Number(el.dataset.n) : null;
};
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

test('円グラフ（全体）: BIG/REG の割合。後告知・小役重複・プレミアの割合も出す。プレミアは外側の線', () => {
  const app = setup();
  assert.equal(seg(app, 'b'), 3);
  assert.equal(seg(app, 'r'), 2);
  assert.equal(seg(app, 'premium'), 3, 'プレミア点滅・フリーズ・バイブ');
  assert.equal(legend(app), 'BIG 60% REG 40% 後告知 40% 小役重複 20% プレミア 60%');
  // 円グラフは左、回数・平均・最大・最小は右
  const top = content(app).querySelector('.hm-top');
  assert.ok(top.firstElementChild.classList.contains('hm-pie'));
  assert.equal(top.querySelectorAll('.hm-stat-box').length, 4);
});

test('円グラフ（BIG / REG）: 先告知・後告知・小役重複。プレミアは外側の線', () => {
  const app = setup();
  app.window.setHitListKind('b');
  assert.deepEqual(['pre', 'post', 'dup', 'premium'].map((k) => seg(app, k)), [2, 1, 0, 2]);
  assert.equal(legend(app), '先告知 67% 後告知 33% 小役重複 0% プレミア 67%');
  app.window.setHitListKind('r');
  assert.deepEqual(['pre', 'post', 'dup', 'premium'].map((k) => seg(app, k)), [0, 1, 1, 1]);
  assert.equal(legend(app), '先告知 0% 後告知 50% 小役重複 50% プレミア 50%');
});

test('円グラフ: 特殊テンパイ音・アメイジングチャンスもプレミア。契機の無い古い記録は先告知', () => {
  const app = setup([
    { g: 10, k: 'b', extras: ['tenpai'] },
    { g: 10, k: 'b', trig: 'bell', notice: 'normal', extras: ['ac'] },
    { g: 10, k: 'b' },
    { g: 10, k: 'b', trig: 'rep', notice: 'normal', extras: [] },
  ]);
  app.window.setHitListKind('b');
  assert.deepEqual(['pre', 'post', 'dup', 'premium'].map((k) => seg(app, k)), [2, 0, 2, 2]);
});

test('円グラフの扇形: 区切りの長さは回数の割合、プレミアの線は外側の輪の割合', () => {
  const app = setup();
  const arc = (k) => {
    const el = content(app).querySelector(`.hm-pie [data-seg="${k}"]`);
    const [len] = el.getAttribute('stroke-dasharray').split(' ').map(Number);
    return len / (2 * Math.PI * Number(el.getAttribute('r')));
  };
  assert.ok(Math.abs(arc('b') - 0.6) < 1e-6);
  assert.ok(Math.abs(arc('r') - 0.4) < 1e-6);
  assert.ok(Math.abs(arc('premium') - 0.6) < 1e-6);
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
