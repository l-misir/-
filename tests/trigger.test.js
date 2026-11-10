// 段階3: 当選の契機・告知の記録と、レトロ条件達成の自動加算のフリーズ除外（docs/DETAIL_MODE_PLAN.md「当選の契機・告知」）
// 契機: 単独(先)/単独(後)/チェリー/スイカ/リプレイ/ベル から1つ（初期値 単独(先)）
// 告知: ノーマル点滅/プレミア点滅/フリーズ から1つ（初期値 ノーマル点滅）＋ 特殊テンパイ音/バイブ/その他（複数可）。
// アメイジングチャンスは 2026-10-05、バウンドストップは 2026-11-11 にボタンを無くした（今までの記録に付いている分は残す）。
// 「その他」はほかのプレミア用（アメイジングが出て困ったため。2026-11-11）
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const stored = (app) => JSON.parse(app.window.localStorage.getItem('hana_v20_data'));
const hitAt = (app, i) => JSON.parse(app.ev(`JSON.stringify(getData().hits[${i}])`));
const optOn = (app, v) => app.document.querySelector(`#hit-panel [data-opt="${v}"]`).classList.contains('on');

function setup() {
  const app = loadApp();
  app.selectMachine('newking');
  return app;
}
async function hit(app, kind, digits) {
  await app.tap(`#main-ui [data-id="${kind}"]`);
  digits.split('').forEach((k) => app.window.hitKey(k));
}

test('BIG/REG を押して作った当選は、契機 単独(先)・告知 ノーマル点滅・付随なし。テンキー画面にボタンが出る', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  const h = hitAt(app, 0);
  assert.equal(h.trig, 'solo1');
  assert.equal(h.notice, 'normal');
  assert.deepEqual(h.extras, []);
  const opts = [...app.document.querySelectorAll('#hit-panel [data-opt]')].map((e) => e.dataset.opt);
  assert.deepEqual(opts, ['solo1', 'solo2', 'che', 'sui', 'rep', 'bell', 'normal', 'premium', 'freeze', 'tenpai', 'vibe', 'other']);
  assert.ok(optOn(app, 'solo1'));
  assert.ok(optOn(app, 'normal'));
  assert.ok(!optOn(app, 'tenpai'));
});

test('テンキー画面で契機・告知を選ぶ: 契機と点滅/フリーズは1つだけ、テンパイ音・バイブ・その他は複数', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  app.window.setHitTrig('che');
  app.window.setHitNotice('premium');
  app.window.toggleHitExtra('vibe');
  app.window.toggleHitExtra('other');
  app.window.toggleHitExtra('tenpai');
  app.window.toggleHitExtra('tenpai'); // もう一度押すと外れる
  const h = hitAt(app, 0);
  assert.equal(h.trig, 'che');
  assert.equal(h.notice, 'premium');
  assert.deepEqual([...h.extras].sort(), ['other', 'vibe']);
  assert.ok(optOn(app, 'che') && !optOn(app, 'solo1'), '押したボタンだけ点く');
  assert.ok(optOn(app, 'premium') && !optOn(app, 'normal'));
  assert.ok(optOn(app, 'vibe') && optOn(app, 'other') && !optOn(app, 'tenpai'));
  app.window.setHitNotice('freeze');
  assert.equal(hitAt(app, 0).notice, 'freeze', '点滅とフリーズは同時に起きない（1つだけ）');
  assert.equal(hitAt(app, 0).g, 300, 'G数はそのまま');
  assert.equal(stored(app).newking.hits[0].trig, 'che', '保存される');
});

test('当選履歴から開くと、その当選の契機・告知が出て、その当選だけを直せる', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  app.window.hitEditSave();
  await hit(app, 'r', '120');
  app.window.hitEditSave();
  // 古い方（BIG、hits[1]）を直す
  app.window.editHitG(1);
  assert.ok(optOn(app, 'solo1'));
  app.window.setHitTrig('rep');
  app.window.hitEditSave();
  assert.equal(hitAt(app, 1).trig, 'rep');
  assert.equal(hitAt(app, 0).trig, 'solo1', '新しい方は変わらない');
  assert.equal(hitAt(app, 1).g, 300);
});

test('古い保存データの当選（契機・告知なし・壊れた値）は初期値で補う', () => {
  const app = loadApp({
    storage: {
      machine: 'king',
      king: { hits: [{ g: 50, k: 'b', pre: 50 }, { g: 300, k: 'r', trig: 'xxx', notice: 'freeze', extras: ['vibe', 'bad', 'vibe'] }] },
    },
  });
  assert.deepEqual(
    [hitAt(app, 0).trig, hitAt(app, 0).notice, hitAt(app, 0).extras],
    ['solo1', 'normal', []],
  );
  assert.deepEqual(
    [hitAt(app, 1).trig, hitAt(app, 1).notice, hitAt(app, 1).extras],
    ['solo1', 'freeze', ['vibe']],
  );
});

// 時系列（古→新）で書いた当たりを、hits（新しい順）にして数える。3つ目は告知
function count(app, seq) {
  const hits = seq.map(([g, k, notice]) => ({ g, k, notice: notice || 'normal' })).reverse();
  return app.ev(`retroAutoCount(${JSON.stringify(hits)})`);
}

test('レトロ条件達成: フリーズの当選自身は対象外。ただし連チャン中の BIG の数には数える', () => {
  const app = loadApp();
  assert.equal(count(app, [[300, 'b'], [50, 'b'], [30, 'b']]), 2, 'BIG3連 → 2連目・3連目で 2');
  assert.equal(count(app, [[300, 'b'], [50, 'b', 'freeze'], [30, 'b']]), 1, '2連目がフリーズ → 3連目だけ');
  // フリーズの BIG も連チャンの BIG に数えるので、その後の5連目は対象外のまま
  assert.equal(count(app, [[300, 'b'], [10, 'b', 'freeze'], [10, 'b'], [10, 'b'], [10, 'b']]), 2);
  assert.equal(count(app, [[300, 'b', 'freeze'], [50, 'b']]), 1, '最初の当たりのフリーズは元々対象外。次の BIG は2連目');
  assert.equal(count(app, [[300, 'b'], [50, 'b', 'premium']]), 1, 'プレミア点滅は外さない');
});

test('テンキー画面でフリーズにすると、レトロ条件達成が1減り、戻すと元に戻る（手で直した分は残す）', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  app.window.hitEditSave();
  await hit(app, 'b', '80'); // BIG2連 → +1
  app.window.hitEditSave();
  assert.equal(app.ev('getData().cur.retro_d'), 1);
  app.ev('getData().cur.retro_d += 2; save(true);'); // 手で +2
  app.window.editHitG(0);
  app.window.setHitNotice('freeze');
  assert.equal(app.ev('getData().cur.retro_d'), 2, '3 − 1');
  app.window.setHitNotice('normal');
  assert.equal(app.ev('getData().cur.retro_d'), 3);
  app.window.setHitNotice('freeze');
  app.window.hitEditSave();
  assert.equal(app.ev('getData().cur.retro_d'), 2);
  assert.equal(stored(app).newking.cur.retro_d, 2);
});

test('当選履歴の一覧: 初期値以外の契機・告知を小さく表示する', async () => {
  const app = setup();
  await hit(app, 'b', '300');
  app.window.hitEditSave();
  await hit(app, 'r', '120');
  app.window.setHitTrig('che');
  app.window.setHitNotice('freeze');
  app.window.toggleHitExtra('vibe');
  app.window.hitEditSave();
  app.window.openHitModal();
  const rows = [...app.document.querySelectorAll('#hm-content .hm-row')];
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /チェリー/);
  assert.match(rows[0].textContent, /フリーズ/);
  assert.match(rows[0].textContent, /バイブ/);
  assert.equal(rows[1].querySelector('.hm-tags'), null, '初期値だけの当選は何も出さない');
});

// jsdom の画面の大きさを変える（縦画面 / 横画面の判定は innerWidth > innerHeight）
function setViewport(app, w, h) {
  Object.defineProperty(app.window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(app.window, 'innerHeight', { value: h, configurable: true });
}

test('テンキー画面（2026-11-11）: 入力した数はキーの上、契機・告知はキーの右（縦横とも）。キーは正方形で全部のテンキーで同じ大きさ', async () => {
  const app = setup();
  const doc = app.document;
  const panel = doc.getElementById('hit-panel');
  const css = doc.querySelector('style').textContent;
  assert.match(css, /--key:\s*54px/, 'キーの大きさは1か所');
  assert.match(css, /\.hit-keys\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*var\(--key\)\)[^}]*grid-auto-rows:\s*var\(--key\)/, 'キーは正方形');
  assert.doesNotMatch(css, /hit-keys-wrap|#hit-panel\.wide/, '前の並び（表示は右・欄は縦画面で下）は無い');

  const layout = () => {
    const tk = panel.querySelector('.tk');
    const main = tk.querySelector(':scope > .tk-main');
    return {
      displayFirst: main.firstElementChild.id === 'hit-display' && main.children[1].classList.contains('hit-keys'),
      optsRight: tk.lastElementChild.id === 'hit-opts' && tk.firstElementChild === main,
    };
  };
  setViewport(app, 375, 667); // 縦画面
  await hit(app, 'b', '300');
  assert.deepEqual(layout(), { displayFirst: true, optsRight: true });
  assert.ok(!panel.classList.contains('centered'));
  assert.equal(panel.style.left, '50%', '縦画面: 画面の下の真ん中');
  assert.equal(panel.style.top, 'auto');
  assert.match(panel.style.bottom, /env\(safe-area-inset-bottom\)/);
  // 告知と付随は1つの欄に続けて（1行2つ）
  assert.deepEqual([...panel.querySelectorAll('.hit-opt-grid')].map((g) => g.children.length), [6, 6]);
  app.window.hitEditSave();
  app.window.editHitG(0);
  assert.ok(panel.classList.contains('centered'), '当選履歴から: 真ん中');
  assert.deepEqual(layout(), { displayFirst: true, optsRight: true });
  app.window.hitEditSave();

  setViewport(app, 667, 375); // 横画面
  await hit(app, 'r', '50');
  assert.deepEqual(layout(), { displayFirst: true, optsRight: true }, '横画面も縦画面と同じ並び');
  assert.equal(panel.style.left, 'auto', '横画面: 右下');
  assert.match(panel.style.right, /env\(safe-area-inset-right\)/);
  app.window.hitEditSave();

  // まとめて加算も同じキー（入力した数はキーの上）
  app.window.openBulkPanel();
  const col = doc.querySelector('.bulk-col-r');
  const disp = doc.getElementById('bulk-display');
  const keys = doc.querySelector('#bulk-keys .hit-keys');
  assert.ok(disp.compareDocumentPosition(keys) & app.window.Node.DOCUMENT_POSITION_FOLLOWING, '表示はキーの上');
  assert.ok(col.contains(disp) && col.contains(keys));
  assert.doesNotMatch(css, /#bulk-keys \.hit-keys\s*\{[^}]*(max-height|grid-template-rows)/, 'まとめて加算のキーも同じ正方形');
});

test('アメイジングチャンス: ボタンは無い。今までの記録に付いている分は、開いて直しても残り、備考・プレミア・シートの文字列にも出る', async () => {
  const app = setup();
  app.ev(`const d = getData(); d.hits = [{ g: 120, k: 'b', trig: 'che', notice: 'normal', extras: ['ac'] }]; d.cur.g = 120; d.cur.b = 1;`);
  app.window.editHitG(0);
  assert.equal(app.document.querySelector('#hit-panel [data-opt="ac"]'), null, 'ボタンは無い');
  assert.equal(app.document.querySelector('#hit-panel [data-opt="other"]').textContent, 'その他');
  assert.equal(app.document.querySelector('#hit-panel [data-opt="tenpai"]').textContent, '特殊テンパイ', 'ボタンに入るよう略す（備考は正式名）');
  app.window.toggleHitExtra('vibe');
  app.window.toggleHitExtra('ac'); // ボタンの無いものは押せない（何も変えない）
  assert.deepEqual(hitAt(app, 0).extras, ['vibe', 'ac'], '開いて別の付随を押しても消えない');
  app.window.hitEditSave();
  app.window.openHitModal();
  assert.match(app.document.querySelector('#hm-content .hm-row .hm-tagline').textContent, /チェリー・バイブ・アメイジングチャンス/);
  assert.equal(app.ev(`hitsToText(getData().hits)`), 'B120[チェリー・バイブ・アメイジングチャンス]');
});

test('その他（2026-11-11）: 備考に出し、プレミアに数え、シートの文字列で読み書きできる。今までのバウンドストップの記録は残す', async () => {
  const app = setup();
  await hit(app, 'r', '80');
  assert.equal(app.document.querySelector('#hit-panel [data-opt="bound"]'), null, 'バウンドストップのボタンは無い');
  app.window.toggleHitExtra('other');
  app.window.hitEditSave();
  app.ev(`getData().hits.push({ g: 40, k: 'b', trig: 'solo1', notice: 'normal', extras: ['bound'] }); save(true);`);
  app.window.openHitModal();
  const tags = [...app.document.querySelectorAll('#hm-content .hm-row .hm-tagline')].map((e) => e.textContent);
  assert.deepEqual(tags, ['その他', 'バウンドストップ']);
  assert.equal(app.document.querySelector('#hm-content .hm-pie [data-seg="premium"]').dataset.n, '2', 'どちらもプレミア');
  const text = app.ev(`hitsToText(getData().hits)`);
  assert.equal(text, 'B40[バウンドストップ] R80[その他]');
  assert.deepEqual(JSON.parse(app.ev(`JSON.stringify(textToHits(${JSON.stringify(text)}).map(h => h.extras))`)), [['other'], ['bound']]);
});
