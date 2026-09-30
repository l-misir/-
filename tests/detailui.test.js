// 段階5: 詳細記録の2画面（docs/DETAIL_MODE_PLAN.md「2画面の配置」「朝一ランプ」）と管理画面
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

function setup(m, extra = '') {
  const app = loadApp();
  app.selectMachine(m);
  app.window.setDetailMode(true);
  if (extra) app.ev(`${extra}; renderMain();`);
  return app;
}
const titles = (app) => [...app.document.querySelectorAll('#main-ui .section-title')].map((e) => e.textContent);
// セルの並び: s=打ち始め c=今の項目 d=詳細 t=取得（合計 − 欠損） l=ランプ
const cells = (app) => [...app.document.querySelectorAll('#main-ui .cell')].map((e) => {
  if (e.dataset.start) return `s:${e.dataset.start}`;
  if (e.dataset.id) return `c:${e.dataset.id}`;
  if (e.dataset.detail) return `d:${e.dataset.detail}`;
  if (e.dataset.take) return `t:${e.dataset.take}`;
  return `l:${e.dataset.type}${e.dataset.idx}`;
});
const dots = (app) => [...app.document.querySelectorAll('#disp-machine .scr-dot')].map((e) => e.textContent).join('');
const cur = (app, k) => app.ev(`getData().cur.${k}`);
const det = (app, k) => app.ev(`getData().detail.${k}`);
const shown = (app, sel) => app.document.querySelector(`#main-ui ${sel} .value`).textContent;
const tapMachine = (app) => { app.window.startMachinePress(); app.window.endMachinePress(); };

test('詳細記録 OFF: 今の画面のまま。機種名をタップしても何もしない・○● も出ない', () => {
  const app = loadApp();
  app.selectMachine('newking');
  assert.equal(app.ev('data.detailMode'), false);
  assert.equal(app.document.querySelector('#main-ui [data-detail]'), null);
  assert.equal(dots(app), '');
  tapMachine(app);
  assert.equal(app.document.querySelector('#main-ui [data-detail]'), null);
});

test('ニューキング: 画面1・画面2 の並び（前半4段・後半4段）。機種名タップで切替、左右の ○● で表示中の画面', () => {
  const app = setup('newking');
  assert.deepEqual(titles(app), ['＜打ち始め＞', '＜現在＞', '＜通常時：小役（3）＞', '＜通常時：小役（3）＞',
    '＜通常時：欠損（3）＞', '＜通常時：欠損（3）＞', '＜REG：小役（1）＞', '＜REG：欠損（1）＞']);
  assert.deepEqual(cells(app), ['s:g', 's:b', 's:r', 'c:g', 'c:b', 'c:r', 'd:nRep', 'c:bell', 'd:nChe', 'd:nSui',
    'd:lnChe', 'd:nCheM', 'd:lnSui', 'd:lAlign', 'd:rChe', 't:suikaR', 'd:lrChe', 'd:lrSui']);
  assert.equal(dots(app), '●○');
  tapMachine(app);
  assert.deepEqual(titles(app), ['＜BIG前半：小役（1）＞', '＜BT：小役（2）＞', '＜BIG前半：欠損（1）＞', '＜BIG後半：欠損（2）＞',
    '＜BIG後半：サイドランプ＞', '＜BIG：筐体ランプ＞', '＜REG：筐体ランプ＞', '＜レトロサウンド＞']);
  assert.deepEqual(cells(app), ['d:bChe', 't:suika', 'd:btRep', 'd:btBell', 'd:lbChe', 'd:lbSui', 'd:lblSui', 'd:lblBell',
    'l:regS0', 'l:regS1', 'l:regS2', 'l:regS3', 'l:regS4', 'd:wBig', 'l:big0', 'l:big1', 'l:big2', 'l:big3', 'l:big4',
    'd:wReg', 'l:regT0', 'l:regT1', 'l:regT2', 'l:regT3', 'c:retro_d', 'c:retro']);
  assert.equal(dots(app), '○●');
  tapMachine(app);
  assert.equal(dots(app), '●○');
  assert.equal(app.document.querySelectorAll('#main-ui .col-left .section-title').length, 4, '前半4段');
  assert.equal(app.document.querySelectorAll('#main-ui .col-right .section-title').length, 4, '後半4段');
});

test('ニューキング以外: 画面1・画面2 の並び。見出しの掛け枚数は機種ごと（キング BIG1・REG2、ホウオウ BIG2）', () => {
  const app = setup('king');
  assert.deepEqual(titles(app), ['＜打ち始め＞', '＜現在＞', '＜通常時：小役（3）＞', '＜通常時：小役（3）＞',
    '＜通常時：小役（1・2）＞', '＜通常時：小役（1・2）＞', '＜通常時：欠損（3）＞', '＜通常時：欠損（1）＞']);
  assert.deepEqual(cells(app), ['s:g', 's:b', 's:r', 'c:g', 'c:b', 'c:r', 'd:nRep', 'c:bell', 'd:nChe', 'd:nSui',
    'd:oRep', 'd:oBell', 'd:oChe', 'd:oSui', 'd:lnChe', 'd:nCheM', 'd:lnSui', 'd:lAlign']);
  app.window.switchDetailScreen();
  assert.deepEqual(titles(app), ['＜BIG：小役（1）＞', '＜BIG：欠損（1）＞', '＜REG：小役（2）＞', '＜REG：欠損（2）＞',
    '＜REG：サイドランプ＞', '＜BIG：筐体ランプ＞', '＜REG：筐体ランプ＞', '＜レトロサウンド＞']);
  assert.deepEqual(cells(app), ['d:bChe', 't:suika', 'd:bMiss', 'd:lbChe', 'd:lbSui', 'd:rMiss', 'd:lrSui',
    'l:regS0', 'l:regS1', 'l:regS2', 'l:regS3', 'l:regS4', 'd:wBig', 'l:big0', 'l:big1', 'l:big2', 'l:big3', 'l:big4',
    'd:wReg', 'l:regT0', 'l:regT1', 'l:regT2', 'l:regT3', 'l:regT4', 'c:retro_d', 'c:retro']);
  const houou = setup('houou');
  houou.window.switchDetailScreen();
  assert.equal(titles(houou)[0], '＜BIG：小役（2）＞');
  assert.ok(app.document.querySelector('#main-ui [data-detail="lbSui"]').classList.contains('loss'), '欠損のセルは赤');
  assert.ok(!app.document.querySelector('#main-ui [data-detail="bChe"]').classList.contains('loss'));
});

test('詳細の欄のタップ: 押した欄だけ増減（長押しで −1、0 未満にしない）。ベルは今の cur.bell', async () => {
  const app = setup('newking');
  await app.tap('#main-ui [data-detail="nRep"]');
  await app.tap('#main-ui [data-detail="nRep"]');
  assert.equal(det(app, 'nRep'), 2);
  assert.equal(shown(app, '[data-detail="nRep"]'), '2');
  await app.tap('#main-ui [data-detail="nRep"]', { long: true });
  await app.tap('#main-ui [data-detail="nRep"]', { long: true });
  await app.tap('#main-ui [data-detail="nRep"]', { long: true });
  assert.equal(det(app, 'nRep'), 0);
  await app.tap('#main-ui [data-id="bell"]');
  assert.equal(cur(app, 'bell'), 1);
  assert.equal(JSON.parse(app.ev('JSON.stringify(tapLog)'))[0].id, 'bell');
  assert.equal(JSON.parse(app.ev('JSON.stringify(tapLog)'))[1].id, 'nRep', '操作ログにも残る');
});

test('スイカの取得と欠損: 取得は合計だけ、欠損は合計と欠損の両方を増減。取得が0なら長押ししても減らない', async () => {
  const app = setup('newking');
  app.window.switchDetailScreen();
  await app.tap('#main-ui [data-take="suika"]');
  assert.deepEqual([cur(app, 'suika'), det(app, 'lbSui')], [1, 0]);
  await app.tap('#main-ui [data-detail="lbSui"]');
  assert.deepEqual([cur(app, 'suika'), det(app, 'lbSui')], [2, 1]);
  assert.equal(shown(app, '[data-take="suika"]'), '1', '取得 = 合計 − 欠損');
  await app.tap('#main-ui [data-take="suika"]', { long: true });
  await app.tap('#main-ui [data-take="suika"]', { long: true });
  assert.deepEqual([cur(app, 'suika'), det(app, 'lbSui')], [1, 1], '取得0で長押ししても減らない');
  await app.tap('#main-ui [data-detail="lbSui"]', { long: true });
  assert.deepEqual([cur(app, 'suika'), det(app, 'lbSui')], [0, 0]);
});

test('サイドランプ確認用の欠損（ニューキングの BIG後半スイカ、それ以外の REGスイカ）はスイカの合計を増やさない', async () => {
  const nk = setup('newking');
  nk.window.switchDetailScreen();
  await nk.tap('#main-ui [data-detail="lblSui"]');
  assert.deepEqual([det(nk, 'lblSui'), cur(nk, 'suika'), cur(nk, 'suikaR')], [1, 0, 0]);
  const king = setup('king');
  king.window.switchDetailScreen();
  await king.tap('#main-ui [data-detail="lrSui"]');
  assert.deepEqual([det(king, 'lrSui'), cur(king, 'suika')], [1, 0]);
  // ニューキングの REGスイカの欠損は REGスイカ（今の項目）の合計に入る
  const nk2 = setup('newking');
  await nk2.tap('#main-ui [data-detail="lrSui"]');
  assert.deepEqual([det(nk2, 'lrSui'), cur(nk2, 'suikaR')], [1, 1]);
});

// 朝一を指定できる状態: 打ち始めの BIG 0・台の BIG 1・BIG筐体ランプ（白を含む）が全部0・未指定
function morningSetup(m) {
  const app = setup(m, 'const d = getData(); d.start.b = 0; d.cur.b = 1');
  app.window.switchDetailScreen();
  return app;
}
const bigLamp = (i) => `#main-ui .t-lamp[data-type="big"][data-idx="${i}"]`;

test('朝一: 台の BIG が 0→1 でランプが全部0の時に押したランプが朝一（回数には入れない）。その後は普通に数える', async () => {
  const app = morningSetup('king');
  await app.tap(bigLamp(0)); // 青
  assert.equal(app.ev('getData().morning'), 1);
  assert.equal(app.ev('getData().lamps.big[0]'), 0, '朝一の分は回数に入れない');
  assert.ok(app.document.querySelector(bigLamp(0)).classList.contains('morning-lamp'), '朝一のボタンは枠の色で分かる');
  assert.equal(app.document.querySelector('#tap-delta-layer [data-key="big0"]').textContent, '朝一');
  await app.tap(bigLamp(0));
  await app.tap(bigLamp(2));
  assert.equal(app.ev('getData().morning'), 1);
  assert.deepEqual(JSON.parse(app.ev('JSON.stringify(getData().lamps.big)')), [1, 0, 1, 0, 0]);
});

test('朝一: 白(不明)も指定できる。虹は朝一にせず普通に数える', async () => {
  const app = morningSetup('newking');
  await app.tap(bigLamp(4)); // 虹
  assert.equal(app.ev('getData().morning'), -1);
  assert.equal(app.ev('getData().lamps.big[4]'), 1);
  const w = morningSetup('newking');
  await w.tap('#main-ui [data-detail="wBig"]');
  assert.equal(w.ev('getData().morning'), 0);
  assert.equal(det(w, 'wBig'), 0);
  assert.ok(w.document.querySelector('#main-ui [data-detail="wBig"]').classList.contains('morning-lamp'));
});

test('朝一: ランプが全部0の間に朝一のボタンを長押しすると外れる。台の BIG が 0 に戻っても外れる', async () => {
  const app = morningSetup('king');
  await app.tap(bigLamp(1));
  assert.equal(app.ev('getData().morning'), 2);
  await app.tap(bigLamp(1), { long: true });
  assert.equal(app.ev('getData().morning'), -1);
  assert.equal(app.ev('getData().lamps.big[1]'), 0);
  assert.equal(app.document.querySelector('#tap-delta-layer [data-key="big1"]').textContent, '朝一解除');
  await app.tap(bigLamp(1));
  assert.equal(app.ev('getData().morning'), 2);
  app.window.switchDetailScreen(); // 画面1 の BIG
  await app.tap('#main-ui [data-id="b"]', { long: true }); // 台の BIG 1 → 0
  assert.equal(cur(app, 'b'), 0);
  assert.equal(app.ev('getData().morning'), -1);
});

test('朝一: 条件を満たさない時は普通に数える（台の BIG 2 以上・打ち始めの BIG 1 以上・ランプが既にある・詳細記録 OFF）', async () => {
  const two = setup('king', 'const d = getData(); d.start.b = 0; d.cur.b = 2');
  two.window.switchDetailScreen();
  await two.tap(bigLamp(0));
  assert.deepEqual([two.ev('getData().morning'), two.ev('getData().lamps.big[0]')], [-1, 1]);
  const mid = setup('king', 'const d = getData(); d.start.b = 1; d.cur.b = 1');
  mid.window.switchDetailScreen();
  await mid.tap(bigLamp(0));
  assert.deepEqual([mid.ev('getData().morning'), mid.ev('getData().lamps.big[0]')], [-1, 1]);
  const lit = setup('king', 'const d = getData(); d.start.b = 0; d.cur.b = 1; d.detail.wBig = 1');
  lit.window.switchDetailScreen();
  await lit.tap(bigLamp(0));
  assert.deepEqual([lit.ev('getData().morning'), lit.ev('getData().lamps.big[0]')], [-1, 1]);
  const off = loadApp();
  off.selectMachine('king');
  off.ev('const d = getData(); d.start.b = 0; d.cur.b = 1; renderMain();');
  await off.tap(bigLamp(0));
  assert.deepEqual([off.ev('getData().morning'), off.ev('getData().lamps.big[0]')], [-1, 1]);
});

test('入力モード: 詳細の欄も入力できる。スイカの取得は「合計 = 取得 + 欠損」で入り、欠損を変えても取得はそのまま', () => {
  const app = setup('newking', 'getData().detail.lbSui = 2; getData().cur.suika = 3');
  app.window.setInputMode('input');
  app.window.switchDetailScreen();
  const input = (sel) => app.document.querySelector(`#main-ui ${sel} input`);
  const set = (sel, v) => { const el = input(sel); el.value = String(v); el.dispatchEvent(new app.window.Event('change')); };
  assert.equal(input('[data-take="suika"]').value, '1');
  set('[data-take="suika"]', 5);
  assert.deepEqual([cur(app, 'suika'), det(app, 'lbSui')], [7, 2]);
  set('[data-detail="lbSui"]', 1);
  assert.deepEqual([cur(app, 'suika'), det(app, 'lbSui')], [6, 1]);
  set('[data-detail="btBell"]', 4);
  assert.equal(det(app, 'btBell'), 4);
});

test('ベルのロックは詳細記録の画面でも効く', () => {
  const app = setup('newking');
  app.window.toggleCountLock('bell');
  assert.ok(app.document.querySelector('#main-ui [data-id="bell"]').classList.contains('locked'));
});

test('設定: 詳細記録 ON/OFF（初期値 OFF）。朝一ランプの設定は無い。左上の🔑で管理画面（スプレッドシート連携・操作ログ）', () => {
  const app = loadApp();
  const doc = app.document;
  assert.ok(doc.getElementById('btn-detail-off').classList.contains('active-mode'));
  app.window.setDetailMode(true);
  assert.ok(doc.getElementById('btn-detail-on').classList.contains('active-mode'));
  assert.ok(doc.querySelector('#main-ui [data-detail]'));
  assert.equal(doc.getElementById('morning-lamp-selector'), null, '朝一は詳細記録の画面で指定する');
  const setting = doc.getElementById('setting-modal');
  assert.equal(setting.querySelector('#gas-url'), null);
  assert.equal(setting.querySelector('#tap-log'), null);
  const key = setting.querySelector('.modal-header .header-icon');
  assert.equal(key.textContent.trim(), '🔑');
  app.window.openModal('admin-modal');
  const admin = doc.getElementById('admin-modal');
  assert.ok(admin.classList.contains('active'));
  assert.equal(admin.querySelector('.modal-title').textContent, '管理画面');
  assert.ok(admin.querySelector('#gas-url') && admin.querySelector('#gas-token') && admin.querySelector('#tap-log'));
  const order = [...doc.querySelectorAll('body > div[id]')].map((e) => e.id);
  assert.ok(order.indexOf('admin-modal') > order.indexOf('setting-modal'), '設定画面より手前に重なる');
});

test('朝一: 打ち始めの操作で台の BIG が 0 になった場合も外れる', async () => {
  const app = morningSetup('king');
  await app.tap(bigLamp(0));
  assert.equal(app.ev('getData().morning'), 1);
  ['start-g', 'start-b', 'start-r'].forEach((k) => app.window.toggleCountLock(k)); // 打ち始めのロックを外す
  app.window.switchDetailScreen(); // 画面1
  await app.tap('#main-ui [data-start="b"]');             // 打ち始め 0→1、台の BIG 1→2
  await app.tap('#main-ui [data-id="b"]', { long: true }); // 台の BIG 2→1
  assert.equal(app.ev('getData().morning'), 1, 'まだ 0 になっていない');
  await app.tap('#main-ui [data-start="b"]', { long: true }); // 打ち始め 1→0、台の BIG 1→0
  assert.equal(cur(app, 'b'), 0);
  assert.equal(app.ev('getData().morning'), -1);
});

test('入力モード: 詳細の欄を確定しても入力欄を作り直さない（フォーカスを外さない）。取得の欄は一緒に書き換える', () => {
  const app = setup('newking', 'getData().detail.lbSui = 2; getData().cur.suika = 3');
  app.window.setInputMode('input');
  app.window.switchDetailScreen();
  const lossInput = app.document.querySelector('#main-ui [data-detail="lbSui"] input');
  lossInput.focus();
  lossInput.value = '1';
  lossInput.dispatchEvent(new app.window.Event('change'));
  assert.ok(app.document.contains(lossInput), '同じ入力欄が残る');
  assert.equal(app.document.activeElement, lossInput);
  assert.equal(app.document.querySelector('#main-ui [data-take="suika"] input').value, '1', '取得はそのまま 1（合計 2 − 欠損 1）');
  const takeInput = app.document.querySelector('#main-ui [data-take="suika"] input');
  takeInput.value = '4';
  takeInput.dispatchEvent(new app.window.Event('change'));
  assert.ok(app.document.contains(takeInput));
  assert.deepEqual([cur(app, 'suika'), det(app, 'lbSui')], [5, 1]);
});

test('入力モードでも朝一のランプに枠を付ける（白・色付き）', async () => {
  const app = morningSetup('king');
  await app.tap(bigLamp(2)); // 緑
  app.window.setInputMode('input');
  assert.ok(app.document.querySelector('#main-ui .cell[data-type="big"][data-idx="2"]').classList.contains('morning-lamp'));
  const w = morningSetup('newking');
  await w.tap('#main-ui [data-detail="wBig"]');
  w.window.setInputMode('input');
  assert.ok(w.document.querySelector('#main-ui .cell[data-detail="wBig"]').classList.contains('morning-lamp'));
});

test('ボタンの表記（ユーザー指定の並び）: 画面1', () => {
  const app = setup('newking');
  const labels = [...app.document.querySelectorAll('#main-ui .cell .label')].map((e) => e.textContent);
  assert.deepEqual(labels, ['ゲーム数', 'BIG', 'REG', 'ゲーム数', 'BIG', 'REG', 'リプレイ', 'ベル', 'チェリー', 'スイカ',
    'チェリー', '中段チェリー', 'スイカ', 'ボーナス', 'チェリー', 'スイカ', 'チェリー', 'スイカ']);
});
