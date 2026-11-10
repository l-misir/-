// 入力モード「加算」（2026-11-11 ユーザー要望。まとめて加算の代わり。入力モードは タップ／入力／加算 の3つ）:
// メイン画面の全部の欄（打ち始めはロックを外したときだけ）が空の入力欄になり、今の数を欄の中に薄く（placeholder）出す。
// 入れた数を今の数に足す（足し方はタップと同じ。当選履歴は作らない）。足した数はタップと同じくボタンの下に出す。
// ダミー表示のときの薄い数はダミーの数
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const apps = [];
test.afterEach(() => { while (apps.length) apps.pop().window.close(); });
function setup(m = 'king') {
  const app = loadApp();
  apps.push(app);
  app.selectMachine(m);
  app.ev('tapDeltaMs = 60000');
  return app;
}
const input = (app, sel) => app.document.querySelector(`#main-ui ${sel} input`);
function addTo(app, sel, v) {
  const inp = input(app, sel);
  if (!inp) throw new Error(`入力欄がない: ${sel}`);
  inp.value = String(v);
  inp.dispatchEvent(new app.window.Event('change'));
  return inp;
}
const deltaText = (app, key) => {
  const el = app.document.querySelector(`#tap-delta-layer .tap-delta[data-key="${key}"]`);
  return el ? el.textContent : null;
};

test('設定画面の入力モードは タップ／入力／加算 の3つ', () => {
  const app = setup();
  const btns = [...app.document.querySelectorAll('#btn-mode-tap, #btn-mode-input, #btn-mode-add')];
  assert.deepEqual(btns.map((b) => b.textContent.trim()), ['タップ', '入力', '加算']);
  assert.equal(btns[0].parentElement, btns[2].parentElement, '同じ並び');
  app.document.getElementById('btn-mode-add').click();
  assert.equal(app.ev('getData() && data.mode'), 'add');
  assert.deepEqual(btns.map((b) => b.classList.contains('active-mode')), [false, false, true]);
  assert.ok(app.document.getElementById('btn-mode-add').querySelector('.haptic-tap'), '押したら振動');
});

test('加算モードは保存して、読み込み直しても加算モードのまま', () => {
  const app = setup();
  app.window.setInputMode('add');
  const saved = JSON.parse(app.ev('localStorage.getItem("hana_v20_data")'));
  assert.equal(saved.mode, 'add');
  const reloaded = loadApp({ storage: saved });
  apps.push(reloaded);
  assert.equal(reloaded.ev('data.mode'), 'add');
  assert.ok(reloaded.document.querySelector('#main-ui [data-id="bell"] input.add-input'));
  const odd = loadApp({ storage: { ...saved, mode: 'bulk' } });
  apps.push(odd);
  assert.equal(odd.ev('data.mode'), 'tap', '知らない値はタップ');
});

test('加算モード: 欄は空の入力欄で、今の数を薄く出す。打ち始めはロック中なら表示だけ', () => {
  const app = setup();
  app.ev('Object.assign(getData().cur, { g: 300, b: 1, r: 2, bell: 10, suika: 3, retro_d: 1, retro: 0 }); getData().lamps.big[0] = 4;');
  app.window.setInputMode('add');
  for (const [sel, v] of [['[data-id="g"]', '300'], ['[data-id="b"]', '1'], ['[data-id="bell"]', '10'], ['[data-id="suika"]', '3'],
    ['[data-id="retro_d"]', '1'], ['[data-id="retro"]', '0'], ['[data-type="big"][data-idx="0"]', '4']]) {
    const inp = input(app, sel);
    assert.ok(inp, sel);
    assert.equal(inp.value, '', `${sel}: 空`);
    assert.equal(inp.placeholder, v, `${sel}: 今の数を薄く`);
    assert.ok(inp.classList.contains('add-input'));
    assert.equal(inp.getAttribute('inputmode'), 'numeric', '数字のキーボード');
  }
  // 打ち始めは初期値でロック → 表示だけ
  const sg = app.document.querySelector('#main-ui [data-start="g"]');
  assert.equal(sg.querySelector('input'), null);
  assert.ok(app.document.querySelector('#main-ui .cell.t-btn') === null, 'タップ処理は付けない');
});

test('加算モード: 入れた数を足し、欄は空に戻して薄い数を書き換える。描き直さない。ボタンの下に +N', () => {
  const app = setup();
  app.ev('getData().cur.bell = 10');
  app.window.setInputMode('add');
  const inp = addTo(app, '[data-id="bell"]', 5);
  assert.equal(app.ev('getData().cur.bell'), 15);
  assert.equal(inp.value, '');
  assert.equal(inp.placeholder, '15');
  assert.equal(input(app, '[data-id="bell"]'), inp, '入力欄を作り直さない（次の欄へ移るときにキーボードが閉じないように）');
  assert.equal(deltaText(app, 'bell'), '+5');
  addTo(app, '[data-id="bell"]', 3);
  assert.equal(app.ev('getData().cur.bell'), 18);
  assert.equal(deltaText(app, 'bell'), '+8', '消える前ならタップと同じく合計');
  assert.equal(JSON.parse(app.ev('localStorage.getItem("hana_v20_data")')).king.cur.bell, 18, '保存する');
  const log = JSON.parse(app.ev('JSON.stringify(tapLog[0])'));
  assert.equal(log.id, 'bell');
  assert.equal(log.ev, 'add');
  assert.equal(log.result, '+3', '操作ログにも残す');
});

test('加算モード: 0・空・数でないときは何もしない（欄は空に戻す）', () => {
  const app = setup();
  app.ev('getData().cur.bell = 10');
  app.window.setInputMode('add');
  for (const v of ['0', '', 'abc']) {
    const inp = addTo(app, '[data-id="bell"]', v);
    assert.equal(inp.value, '');
  }
  assert.equal(app.ev('getData().cur.bell'), 10);
  assert.equal(deltaText(app, 'bell'), null);
});

test('加算モード: マイナスを入れたら引く（下限はタップと同じ。G数は打ち始め未満にしない）', () => {
  const app = setup();
  app.ev('Object.assign(getData().start, { g: 100 }); Object.assign(getData().cur, { g: 150, bell: 2 });');
  app.window.setInputMode('add');
  addTo(app, '[data-id="bell"]', -5);
  assert.equal(app.ev('getData().cur.bell'), 0);
  assert.equal(deltaText(app, 'bell'), '-2', '実際に変わった数');
  addTo(app, '[data-id="g"]', -80);
  assert.equal(app.ev('getData().cur.g'), 100);
});

test('加算モード: BIG/REG を足しても当選履歴は作らない。G数を足したらハマりも伸びる', async () => {
  const app = setup('newking');
  await app.tap('[data-id="b"]'); // タップで BIG を 100G で記録
  ['1', '0', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  app.window.setInputMode('add');
  addTo(app, '[data-id="b"]', 2);
  addTo(app, '[data-id="r"]', 1);
  assert.equal(app.ev('getData().cur.b'), 3);
  assert.equal(app.ev('getData().cur.r'), 1);
  assert.equal(app.ev('getData().hits.length'), 1, '当選履歴はタップ入力分のみ');
  assert.equal(app.document.getElementById('hit-panel').classList.contains('active'), false, 'テンキーも開かない');
  addTo(app, '[data-id="g"]', 30);
  app.window.openHitModal();
  assert.equal(app.document.querySelector('.hm-now-g').textContent, '30G');
  app.window.closeHitModal();
});

test('加算モード: 打ち始め（ロックを外したとき）は現在も同じだけずらす', () => {
  const app = setup();
  app.ev('Object.assign(getData().start, { g: 1000 }); Object.assign(getData().cur, { g: 1200 });');
  app.window.toggleCountLock('start-g');
  app.window.setInputMode('add');
  const inp = addTo(app, '[data-start="g"]', 500);
  assert.equal(app.ev('getData().start.g'), 1500);
  assert.equal(app.ev('getData().cur.g'), 1700);
  assert.equal(inp.placeholder, '1500');
  assert.equal(input(app, '[data-id="g"]').placeholder, '1700', '現在の欄の薄い数も書き換える');
  assert.equal(deltaText(app, 'start-g'), '+500');
});

test('加算モード（詳細記録）: of 付きの欠損は合計にも入り、取得はそのまま。取得の欄は合計に足す', () => {
  const app = setup('newking');
  app.window.setDetailMode(true);
  app.window.switchDetailScreen(); // 画面2（BIG前半の欄）
  app.ev('getData().cur.suika = 10; getData().detail.lbSui = 2;');
  app.window.setInputMode('add');
  const take = input(app, '[data-take="suika"]');
  assert.equal(take.placeholder, '8');
  addTo(app, '[data-detail="lbSui"]', 3);
  assert.equal(app.ev('getData().detail.lbSui'), 5);
  assert.equal(app.ev('getData().cur.suika'), 13);
  assert.equal(take.placeholder, '8', '取得はそのまま');
  addTo(app, '[data-take="suika"]', 4);
  assert.equal(app.ev('getData().cur.suika'), 17);
  assert.equal(take.placeholder, '12');
  assert.equal(deltaText(app, 'take-suika'), '+4');
  addTo(app, '[data-detail="bChe"]', 6);
  assert.equal(app.ev('getData().detail.bChe'), 6);
  addTo(app, '[data-type="big"][data-idx="1"]', 2);
  assert.equal(app.ev('getData().lamps.big[1]'), 2);
});

test('加算モード（ダミー表示）: 薄い数はダミーの数。足したら一番下の数字も動く', () => {
  const app = setup();
  app.ev('getData().cur.bell = 10; getData().lamps.big[0] = 4;');
  app.window.setDummyDefault(true);
  app.window.setInputMode('add');
  const inp = input(app, '[data-id="bell"]');
  const didx = Number(inp.closest('.cell').dataset.didx);
  const dummy = (v, kind) => String(app.ev(`dummyNum(${v}, ${didx}, '${kind}')`));
  assert.equal(inp.placeholder, dummy(10, 'two'));
  assert.notEqual(inp.placeholder, '10');
  assert.ok(inp.classList.contains('dummy'), 'ダミーは桁が多いので薄い数を小さめに');
  addTo(app, '[data-id="bell"]', 7);
  assert.equal(inp.placeholder, dummy(17, 'two'));
  const lamp = input(app, '[data-type="big"][data-idx="0"]');
  const ldidx = Number(lamp.closest('.cell').dataset.didx);
  assert.equal(lamp.placeholder, String(app.ev(`dummyNum(4, ${ldidx}, 'one')`)));
});

test('加算モード: ロックした項目は表示だけ（入力欄を出さない）', () => {
  const app = setup();
  app.window.toggleCountLock('suika');
  app.window.setInputMode('add');
  const cell = app.document.querySelector('#main-ui [data-id="suika"]');
  assert.equal(cell.querySelector('input'), null);
  assert.ok(cell.classList.contains('locked'));
  assert.ok(input(app, '[data-id="bell"]'), 'ロックしていない項目は入れられる');
});

test('加算モード: 数値だけの書き換え（テンキーを閉じたときなど）は入力欄を作り直さず、薄い数を書き換える', async () => {
  const app = setup('newking');
  await app.tap('[data-id="b"]');
  ['1', '0', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  app.window.setInputMode('add');
  const g = input(app, '[data-id="g"]');
  assert.equal(g.placeholder, '100');
  app.ev('getData().cur.g = 130');
  app.ev('refreshMainValues()');
  assert.equal(input(app, '[data-id="g"]'), g, '作り直さない');
  assert.equal(g.placeholder, '130');
});

test('まとめて加算は無い（画面・関数とも）', () => {
  const app = setup();
  assert.equal(app.document.getElementById('bulk-panel'), null);
  assert.equal(app.ev('typeof openBulkPanel'), 'undefined');
  const body = app.document.body.cloneNode(true);
  body.querySelectorAll('script, style').forEach((e) => e.remove());
  assert.ok(!/まとめて加算/.test(body.textContent), '画面に出る文字にも無い');
});
