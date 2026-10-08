// 表示の調整（2026-10）: 小役・欠損のダミー表示（2026-10-04 に前後2桁ずつへ戻し、タップで一番下も +1）、ダミー中も機種名は薄くしない、
// カウントロックの画面はメイン画面と同じボタン（大きさ・表示）で説明文なし、設定画面のボタンの間隔をそろえる
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const shown = (app, sel) => app.document.querySelector(`#main-ui ${sel} .value`).textContent;

test('ダミー表示: ベル・スイカ（小役）は前後に2桁ずつ足す（1桁なら5桁。本当の数の桁が増えると1桁ずつ増える）', () => {
  // 2026-10-04: 「5桁にそろえる」をやめ、以前のベルと同じ 15○94 → 15○○94 → 15○○○94 に戻す
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('const d = getData(); d.cur.bell = 7; d.cur.suika = 31; d.cur.suikaR = 400; d.cur.retro = 2; d.lamps.big[0] = 3;');
  app.window.setDummyDefault(true);
  const bell = shown(app, '[data-id="bell"]');
  assert.equal(bell.length, 5);
  assert.equal(bell.slice(2, 3), '7', '1桁: 前2桁・後2桁で5桁');
  const sui = shown(app, '[data-id="suika"]');
  assert.equal(sui.length, 6);
  assert.equal(sui.slice(2, 4), '31', '2桁: 6桁');
  const suiR = shown(app, '[data-id="suikaR"]');
  assert.equal(suiR.length, 7);
  assert.equal(suiR.slice(2, 5), '400', '3桁: 7桁');
  assert.notEqual(bell[0], '0', '先頭は0にしない');
  app.ev('getData().cur.bell = 1234; renderMain();');
  assert.equal(shown(app, '[data-id="bell"]').slice(2, 6), '1234', '4桁: 8桁');
  assert.equal(shown(app, '[data-id="bell"]').length, 8);
  assert.equal(shown(app, '[data-id="retro"]').length, 5, 'レトロも前後2桁（2 → 5桁）');
  assert.equal(shown(app, '.t-lamp[data-type="big"][data-idx="0"]').length, 3, 'ランプは今までどおり前後1桁');
  assert.equal(app.ev('getData().cur.bell'), 1234, '内部値は変えない');
});

test('ダミー表示（詳細記録）: 小役・欠損・取得の欄も前後2桁ずつ。筐体ランプの白(不明)はランプと同じ', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  app.ev('const d = getData(); d.detail.nRep = 158; d.detail.lnChe = 2; d.cur.suika = 3; d.detail.lbSui = 1; d.detail.wBig = 1;');
  app.window.setDummyDefault(true);
  assert.equal(shown(app, '[data-detail="nRep"]').length, 7);
  assert.equal(shown(app, '[data-detail="nRep"]').slice(2, 5), '158');
  assert.equal(shown(app, '[data-detail="lnChe"]').length, 5);
  app.window.switchDetailScreen();
  assert.equal(shown(app, '[data-take="suika"]').length, 5, '取得 = 3 − 1 = 2');
  assert.equal(shown(app, '[data-detail="lbSui"]').length, 5);
  assert.equal(shown(app, '[data-detail="wBig"]').length, 3);
  // タップした後の書き換えでも同じ
  app.window.switchDetailScreen();
  app.ev('refreshMainValues();');
  assert.equal(shown(app, '[data-detail="nRep"]').length, 7);
});

// ダミー表示の前2桁・後2桁を取り出す（本当の数は真ん中）
const parts = (s, n = 2) => ({ pre: s.slice(0, n), mid: s.slice(n, s.length - n), post: s.slice(-n) });

test('ダミー表示: タップするたびに一番下の数字も +1（9 の次は 0、下から2桁目はそのまま）。長押し（−1）は −1', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('getData().cur.bell = 5; renderMain();');
  app.window.setDummyDefault(true);
  let prev = parts(shown(app, '[data-id="bell"]'));
  for (let i = 1; i <= 12; i++) { // 10回以上押して 9 → 0 の折り返しも通る（本当の数も 9 → 10 で桁が増える）
    await app.tap('#main-ui [data-id="bell"]');
    const now = parts(shown(app, '[data-id="bell"]'));
    assert.equal(now.mid, String(5 + i), '真ん中は本当の数');
    assert.equal(now.pre, prev.pre, '前2桁は変えない');
    assert.equal(now.post[0], prev.post[0], '下から2桁目は変えない');
    assert.equal(Number(now.post[1]), (Number(prev.post[1]) + 1) % 10, '一番下は +1（9 の次は 0）');
    prev = now;
  }
  await app.tap('#main-ui [data-id="bell"]', { long: true });
  const back = parts(shown(app, '[data-id="bell"]'));
  assert.equal(back.mid, '16');
  assert.equal(Number(back.post[1]), (Number(prev.post[1]) + 9) % 10, '長押しで −1');
  assert.equal(app.ev('getData().cur.bell'), 16);
});

test('ダミー表示: ランプ・詳細記録の欄・取得の欄も、タップで一番下の数字が +1', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  app.window.setDummyDefault(true);
  const check = async (sel, n) => {
    const before = parts(shown(app, sel), n);
    await app.tap(`#main-ui ${sel}`);
    const after = parts(shown(app, sel), n);
    assert.equal(after.pre, before.pre, sel);
    assert.equal(after.post.slice(0, -1), before.post.slice(0, -1), sel);
    assert.equal(Number(after.post.slice(-1)), (Number(before.post.slice(-1)) + 1) % 10, sel);
  };
  await check('[data-detail="nRep"]', 2);
  await check('[data-detail="lnChe"]', 2);
  app.window.switchDetailScreen();
  await check('[data-take="suika"]', 2);
  await check('.t-lamp[data-type="regS"][data-idx="0"]', 1);
  await check('[data-detail="wBig"]', 1);
});

test('ダミー表示中も機種名は薄くしない', () => {
  const app = loadApp({ storage: { machine: 'newking', dummyDefault: true } });
  assert.equal(app.ev('dummyMode'), true);
  assert.notEqual(app.document.getElementById('disp-machine').style.opacity, '0.5');
});

test('カウントロックの画面: 説明文なし。ボタンはメイン画面と同じ（数値を出し、ロックは暗くして🔒）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('getData().cur.bell = 123; renderMain();');
  app.window.openModal('lock-modal');
  assert.equal(app.document.querySelector('#lock-modal .gas-note'), null, '説明文は出さない');
  assert.equal(app.document.querySelector('#lock-body [data-lock="bell"] .value').textContent, '123', 'メイン画面と同じく数値を出す');
  assert.ok(app.document.querySelector('#lock-body [data-lock="start-g"]').classList.contains('locked'));
  const css = app.document.querySelector('style').textContent;
  assert.doesNotMatch(css, /\.lock-cell\s*\{[^}]*min-height/, 'ボタンの大きさはメイン画面と同じ');
  assert.doesNotMatch(css, /\.lock-cell \.value\s*\{/, '数値の大きさもメイン画面と同じ');
  assert.doesNotMatch(css, /\.lock-cell\.locked::after\s*\{\s*content:\s*none/, 'ロックの🔒もメイン画面と同じ');
});

test('設定画面: カウントロック・データ保存・リセットのボタンの間隔をそろえる（20px）', () => {
  const app = loadApp();
  const css = app.document.querySelector('style').textContent;
  assert.match(css, /\.lock-btn\s*\{[^}]*margin-top:\s*20px/);
  assert.match(css, /\.export-btn\s*\{[^}]*margin-top:\s*20px/);
  const reset = [...app.document.querySelectorAll('#setting-modal button')].find((b) => b.textContent === 'リセット');
  assert.match(reset.getAttribute('style'), /margin-top:\s*20px/);
});

test('カウントロックの画面のダミー表示は、メイン画面と同じ数（詳細記録の画面2も）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  app.ev('const d = getData(); d.detail.btBell = 7; d.cur.bell = 55;');
  app.window.setDummyDefault(true);
  app.window.switchDetailScreen(); // メイン画面は画面2
  const main = app.document.querySelector('#main-ui [data-detail="btBell"] .value').textContent;
  app.window.openModal('lock-modal');
  assert.equal(app.document.querySelector('#lock-body [data-lock="btBell"] .value').textContent, main);
});

test('カウントロックの画面: 入力モード＋ダミー表示でも、数値の大きさをメイン画面と同じにする', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('getData().cur.bell = 55;');
  app.window.setInputMode('input');
  app.window.setDummyDefault(true);
  app.window.openModal('lock-modal');
  const size = (sel) => app.document.querySelector(sel).style.fontSize;
  assert.equal(size('#lock-body [data-lock="bell"] .value'), size('#main-ui [data-id="bell"] .value'));
  assert.equal(size('#lock-body [data-lock="bell"] .value'), '14px');
  assert.equal(size('#lock-body [data-lock="start-g"] .value'), size('#main-ui [data-start="g"] .value'), 'ロック中は今までの大きさ');
  assert.equal(size('#lock-body [data-lock="big0"] .value'), size('#main-ui [data-type="big"][data-idx="0"] .value'));
});

test('設定推測の詳細データ: 推測に使う行は項目名の左端に青い線（要素調整が 0% の要素は付けない）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.window.setDetailMode(true);
  app.ev(`const d = getData(); d.cur.g = 1000; d.cur.b = 4; d.cur.r = 3; d.cur.bell = 130; d.cur.suika = 3; d.cur.suikaR = 1;
    d.cur.retro_d = 2; d.cur.retro = 1; d.detail.nRep = 140; d.detail.nChe = 20; d.detail.btRep = 2; calc();`);
  const est = (id) => app.document.getElementById(`row-${id}`).classList.contains('est');
  ['b', 'r', 'gas', 'bel', 'sui', 'suiR', 'sl', 'bl', 'rl', 'ret'].forEach((id) => assert.ok(est(id), id));
  ['g', 'nrep', 'nche', 'btrep'].forEach((id) => assert.ok(!est(id), id));
  assert.ok([...app.document.querySelectorAll('#detail-rows tr.est')].length >= 10);
  // 色ごとの行（長押しで開く）も、元の行と同じ
  assert.ok(app.document.querySelector('#detail-rows tr.bl-colors').classList.contains('est'));
  const css = app.document.querySelector('style').textContent;
  assert.match(css, /tr\.est\s*>\s*th\s*\{[^}]*box-shadow:\s*inset 3px 0 0/);
  // 要素調整でベルを 0% にすると、ベルの行は推測に使わないので線を消す
  app.ev('data.weights.newking.bell = 0; calc();');
  assert.ok(!est('bel'));
  assert.ok(est('b'));
});

test('ボタンの下の +1/−1 は 4.1 秒（1回転分）出す。朝一ランプの枠は黒（目立たせすぎない）', () => {
  const app = loadApp();
  assert.equal(app.ev('tapDeltaMs'), 4100);
  const css = app.document.querySelector('style').textContent;
  assert.match(css, /\.morning-lamp\s*\{\s*box-shadow:\s*inset 0 0 0 2px #000;\s*\}/);
});

test('入力モード＋ダミー表示: 打ち始めは（ロックを外していれば）入力できる。それ以外の欄は今までどおり表示だけ（2026-10-08）', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('const d = getData(); d.start.g = 1200; d.cur.g = 1500; d.cur.bell = 55; renderMain();');
  app.window.setInputMode('input');
  app.window.setDummyDefault(true);
  const doc = app.document;
  assert.equal(doc.querySelector('#main-ui [data-start="g"] input'), null, 'ロック中（初期値）は今までどおり表示だけ');
  app.window.toggleCountLock('start-g');
  const inp = doc.querySelector('#main-ui [data-start="g"] input');
  assert.ok(inp, 'ロックを外せば入力欄');
  assert.equal(inp.value, '1200', '打ち始めはダミーにしない本当の数');
  assert.equal(doc.querySelector('#main-ui [data-id="bell"] input'), null, 'ほかの欄は表示だけ');
  assert.notEqual(doc.querySelector('#main-ui [data-id="bell"] .value').textContent, '55');
  inp.value = '1300';
  inp.dispatchEvent(new app.window.Event('change'));
  assert.equal(app.ev('getData().start.g'), 1300);
  assert.equal(app.ev('getData().cur.g'), 1600, '現在も同じだけずらす');
});
