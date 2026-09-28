// 大当たり分布: 当選履歴の平均・100G目盛りの棒、確率表の全体/BIG/REG
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

function setup({ hits, curG, start = { g: 0, b: 0, r: 0 } }) {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`
    const d = getData();
    d.start = ${JSON.stringify(start)};
    d.hits = ${JSON.stringify(hits)};
    d.cur.g = ${curG};
    calc();
  `);
  app.window.openHitModal();
  return app;
}
const content = (app) => app.document.getElementById('hm-content');
const stat = (app, label) => [...content(app).querySelectorAll('.hm-stat-box')]
  .find((b) => b.querySelector('.hm-stat-l').textContent === label)
  .querySelector('.hm-stat-v').textContent;

test('当選履歴の平均: 前回の当たりからのG数（今のハマり）も含めて計算する', () => {
  // 時系列（古→新）: 60G→BIG, 200G→REG, 100G→BIG, 今150G ハマり中。hits は新しい順
  const app = setup({ hits: [{ g: 100, k: 'b' }, { g: 200, k: 'r' }, { g: 60, k: 'b' }], curG: 510 });
  // 全体: (60+200+100 + 150) / 3 = 170
  assert.equal(stat(app, '平均'), '1/170');
  // BIG: BIG間 [60, 200+100=300]、最新BIGからのハマり 150 → (360+150)/2 = 255
  app.window.setHitListKind('b');
  assert.equal(stat(app, '平均'), '1/255');
  // REG: REG間 [60+200=260]、最新REGからのハマり 100+150=250 → (260+250)/1 = 510
  app.window.setHitListKind('r');
  assert.equal(stat(app, '平均'), '1/510');
});

test('当選履歴の平均: ハマりが0Gなら従来どおり', () => {
  const app = setup({ hits: [{ g: 100, k: 'b' }, { g: 200, k: 'r' }], curG: 300 });
  assert.equal(stat(app, '平均'), '1/150');
});

test('当選履歴のメモリ: 100G ごとに1個点く（1〜100Gで1個、101〜200Gで2個…）、1000G超えは10個＋↑', () => {
  const gs = [1250, 1000, 250, 201, 200, 101, 100, 1, 0, null];
  const hits = gs.map((g) => ({ g, k: 'b' }));
  const app = setup({ hits, curG: 3104 });
  const rows = [...content(app).querySelectorAll('.hm-row')];
  assert.equal(rows.length, gs.length);
  const lit = rows.map((r) => r.querySelectorAll('.hm-cell.on').length);
  assert.deepEqual(lit, [10, 10, 3, 3, 2, 2, 1, 1, 0, 0]);
  assert.ok(rows.every((r) => r.querySelectorAll('.hm-cell').length === 10), 'メモリは常に10個');
  assert.deepEqual(rows.map((r) => !!r.querySelector('.hm-over')), [true, false, false, false, false, false, false, false, false, false]);
});

test('当選履歴のメモリ: BIG/REG で絞ったとき、未入力を含む区間は点けない（↑も出さない）', () => {
  // 時系列（古→新）: 100G→BIG, 1200G→REG, 未入力→BIG。BIG 表示の最新は「1200G*」（未入力を含む）
  const app = setup({ hits: [{ g: null, k: 'b' }, { g: 1200, k: 'r' }, { g: 100, k: 'b' }], curG: 1300 });
  app.window.setHitListKind('b');
  const rows = [...content(app).querySelectorAll('.hm-row')];
  assert.match(rows[0].textContent, /1200G\*/);
  assert.equal(rows[0].querySelectorAll('.hm-cell.on').length, 0);
  assert.equal(rows[0].querySelector('.hm-over'), null);
  assert.equal(rows[1].querySelectorAll('.hm-cell.on').length, 1); // 100G は1個
});

test('当選履歴のメモリ: 色は少ない→多いで 青→緑→黄→赤（メモリの位置ごと、BIG/REG で変えない）', () => {
  const app = setup({ hits: [{ g: 1000, k: 'b' }, { g: 1000, k: 'r' }], curG: 2000 });
  const colors = (row) => [...row.querySelectorAll('.hm-cell')].map((c) => c.style.getPropertyValue('--c'));
  const [big, reg] = [...content(app).querySelectorAll('.hm-row')];
  assert.deepEqual(colors(big), colors(reg), 'BIG と REG で同じ色');
  assert.equal(new Set(colors(big)).size, 10, '位置ごとに色が違う');
  const hue = (hex) => { // 青は約210°、緑は約120°、黄は約50°、赤は約0°
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.trim().slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const hs = colors(big).map(hue);
  assert.ok(hs[0] > 180 && hs[0] < 240, '1個目は青');
  assert.ok(hs[9] < 15 || hs[9] > 345, '10個目は赤');
  for (let i = 1; i < 10; i++) assert.ok(hs[i] <= hs[i - 1], '青→緑→黄→赤の順に色相が下がる');
});

test('確率表: BIG・REG は 2000G まで（分母の N 倍は 2000G 未満、1000G と 2000G の行）。全体は 1000G まで', () => {
  const app = setup({ hits: [{ g: 150, k: 'b' }, { g: 1600, k: 'r' }, { g: 300, k: 'b' }], curG: 2050 });
  app.window.setHitTab('prob');
  app.window.setProbSet(0);
  const rows = () => [...content(app).querySelectorAll('.prob-table tr')].slice(1)
    .map((tr) => [Number(tr.querySelector('.prob-g').textContent.replace('G', '')), tr.querySelector('td:last-child').textContent]);
  for (const [kind, key] of [['b', 'b'], ['r', 'r']]) {
    app.window.setHitListKind(kind);
    const denom = app.ev(`ALL_PARAMS.newking.${key}[0]`);
    const r = rows();
    const gs = r.map(([g]) => g);
    assert.equal(Math.max(...gs), 2000, `${kind}: 最後は 2000G`);
    assert.ok(gs.includes(1000), `${kind}: 1000G の行も残す`);
    assert.deepEqual(gs, [...gs].sort((a, b) => a - b), `${kind}: G数の昇順`);
    const mults = r.filter(([, note]) => /倍/.test(note)).map(([g]) => g);
    const expected = [];
    for (let m = 2; Math.ceil(denom * m) < 2000; m++) expected.push(Math.ceil(denom * m));
    assert.deepEqual(mults, expected, `${kind}: 分母の N 倍は 2000G 未満まで`);
  }
  app.window.setHitListKind('all');
  assert.equal(Math.max(...rows().map(([g]) => g)), 1000, '全体は 1000G まで');
});

test('確率表: 全体/BIG/REG を当選履歴と共通のボタンで切り替え、設定の選択はその下', () => {
  const app = setup({
    hits: [{ g: 50, k: 'r' }, { g: 150, k: 'b' }, { g: 300, k: 'b' }, { g: 90, k: 'r' }],
    curG: 590,
  });
  app.window.setHitListKind('b');
  app.window.setHitTab('prob');
  app.window.setProbSet(0);
  const c = content(app);
  const kindBtn = c.querySelector('.hm-sub .hm-sub-btn.active');
  assert.equal(kindBtn.textContent, 'BIG', '当選履歴で選んだ種別のまま');
  // ボタンの並び: 種別 → 設定
  assert.ok(c.querySelector('.hm-sub').compareDocumentPosition(c.querySelector('.set-tabs'))
    & app.window.Node.DOCUMENT_POSITION_FOLLOWING);
  const denom = app.ev('ALL_PARAMS.newking.b[0]');
  assert.match(c.textContent, new RegExp(`BIG 1/${denom.toFixed(1)}`));
  // 時系列（古→新）: 90G→REG, 300G→BIG, 150G→BIG, 50G→REG。BIG の間隔は 90+300=390 と 150 の2回
  assert.match(c.textContent, /実績 2回/);
  const row100 = [...c.querySelectorAll('.prob-table tr')].find((tr) => tr.querySelector('.prob-g')?.textContent === '100G');
  const th = (1 - Math.pow(1 - 1 / denom, 100)) * 100;
  assert.equal(row100.querySelector('.prob-th').textContent, `${(Math.floor(th * 10) / 10).toFixed(1)}%`);

  app.window.setHitListKind('r');
  assert.match(content(app).textContent, new RegExp(`REG 1/${app.ev('ALL_PARAMS.newking.r[0]').toFixed(1)}`));
  app.window.setHitListKind('all');
  assert.match(content(app).textContent, /合算 1\//);
  assert.match(content(app).textContent, /実績 4回/);
});
