// メイン画面のタップ判定: 「振動した（click が来た）のに数えない」を無くす
// iPhone の振動は振動用ラベルの click、加算は pointerup。iOS が pointerup の代わりに pointercancel を送ったり、
// pointerup が届かなかったりしても、click が来たら1回だけ数える
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

function setup() {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('getData().cur.bell = 10; renderMain();');
  return app;
}
const bell = (app) => app.ev('getData().cur.bell');

// 1回の押下を細かく再現する。steps: 'down' | 'up' | 'cancel' | 'move' | 'click' | 'wait:ms'
async function gesture(app, selector, steps) {
  const el = app.document.querySelector(selector);
  const ev = (type, extra = {}) => {
    const e = new app.window.Event(type, { bubbles: true });
    Object.assign(e, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 }, extra);
    return e;
  };
  for (const s of steps) {
    if (s.startsWith('wait:')) await new Promise((r) => setTimeout(r, Number(s.slice(5))));
    else if (s === 'down') el.onpointerdown(ev('pointerdown'));
    else if (s === 'up') el.onpointerup(ev('pointerup'));
    else if (s === 'cancel') el.onpointercancel(ev('pointercancel'));
    else if (s === 'move') el.onpointermove(ev('pointermove', { clientX: 80 }));
    else if (s === 'click') (el.querySelector('.haptic-tap') || el).click(); // 振動用ラベルの click（iOS の本物のタップ）
  }
}

test('ふつうのタップ（down → up → click）は1回だけ数える', async () => {
  const app = setup();
  await gesture(app, '[data-id="bell"]', ['down', 'up', 'click']);
  assert.equal(bell(app), 11);
});

test('iOS が pointerup の代わりに pointercancel を送っても、click が来たら数える', async () => {
  const app = setup();
  await gesture(app, '[data-id="bell"]', ['down', 'cancel', 'click']);
  assert.equal(bell(app), 11);
});

test('pointerup が届かなくても、click が来たら数える', async () => {
  const app = setup();
  await gesture(app, '[data-id="bell"]', ['down', 'click']);
  assert.equal(bell(app), 11);
});

test('長押し（300ms以上）で pointercancel → click なら −1（長押しの判定は押した時間で）', async () => {
  const app = setup();
  await gesture(app, '[data-id="bell"]', ['down', 'wait:350', 'cancel', 'click']);
  assert.equal(bell(app), 9);
});

test('指を大きく動かしてキャンセルした押下は、click が来ても数えない', async () => {
  const app = setup();
  await gesture(app, '[data-id="bell"]', ['down', 'move', 'up', 'click']);
  assert.equal(bell(app), 10);
});

test('連打: 押下ごとに1回ずつ数える（click の二重発火で二重に数えない）', async () => {
  const app = setup();
  for (let i = 0; i < 5; i++) await gesture(app, '[data-id="bell"]', ['down', i % 2 ? 'cancel' : 'up', 'click']);
  assert.equal(bell(app), 15);
});

test('click で補って数えた後、前の押下の長押しタイマーが残って次のタップを −1 にしない', async () => {
  const app = setup();
  await gesture(app, '[data-id="bell"]', ['down', 'click']); // up/cancel なしで click → +1
  // 前の押下の 300ms タイマーが残っていると、ここで −1 の印（minus-mode）が付く（負荷で遅れても待てば分かる）
  await new Promise((r) => setTimeout(r, 450));
  const cell = app.document.querySelector('[data-id="bell"]');
  assert.ok(!cell.classList.contains('minus-mode'), '前の押下のタイマーは止まっている');
  await gesture(app, '[data-id="bell"]', ['down', 'up', 'click']); // 次の短いタップは +1
  assert.equal(bell(app), 12);
});

test('タップの記録: 実際の増減を記録する（G数は +50、下限で変わらなければ「変化なし」）', async () => {
  const app = setup();
  app.ev('getData().cur.retro = 0; renderMain();');
  await gesture(app, '[data-id="g"]', ['down', 'up', 'click']);
  await gesture(app, '[data-id="retro"]', ['down', 'wait:350', 'up', 'click']); // 0 で長押し
  await gesture(app, '[data-id="bell"]', ['down', 'wait:350', 'click']); // up/cancel なし
  const [bellLog, retroLog, gLog] = JSON.parse(app.ev('JSON.stringify(tapLog)'));
  assert.equal(gLog.result, '+50');
  assert.equal(retroLog.result, '変化なし(長押し・下限)');
  assert.equal(bellLog.result, '-1(click補完)');
  assert.ok(bellLog.ms >= 300, 'up/cancel が無くても click までの時間を残す');
  assert.match(bellLog.ev, /click/);
});

test('タップの記録: 下限で途中までしか減らなかったら、実際に減った量を記録する', async () => {
  const app = setup();
  app.ev('const d = getData(); d.start.g = 1000; d.cur.g = 1025; renderMain();');
  await gesture(app, '[data-id="g"]', ['down', 'wait:350', 'up', 'click']); // −50 のつもりが打ち始め 1000 で止まる
  assert.equal(app.ev('getData().cur.g'), 1000);
  assert.equal(JSON.parse(app.ev('JSON.stringify(tapLog)'))[0].result, '-25');
});

test('セルで押し始めていない click（見出しを押して iOS が近くのセルに回した click）は打ち消す: 数えず、振動もしない', () => {
  const app = setup();
  const label = app.document.querySelector('[data-id="bell"] .haptic-tap');
  const input = label.querySelector('input');
  label.click(); // pointerdown はセルに来ていない（見出しの文字を押した）
  assert.equal(bell(app), 10, '数えない');
  assert.equal(input.checked, false, 'スイッチが切り替わらない＝振動しない');
  const [entry] = JSON.parse(app.ev('JSON.stringify(tapLog)'));
  assert.equal(entry.id, 'bell');
  assert.equal(entry.result, '打ち消し(枠外のclick)');
});

test('前の押下で click が来なかった後に見出しを押しても、回ってきた click は打ち消す', async () => {
  const app = setup();
  await gesture(app, '[data-id="bell"]', ['down', 'cancel']); // click が来ないまま終わった押下
  // 続けて「＜ベル＞」の見出しで押し始め、iOS がベルのラベルに click を回した
  const title = [...app.document.querySelectorAll('#main-ui .section-title')].find((e) => e.textContent.includes('ベル'));
  title.dispatchEvent(Object.assign(new app.window.Event('pointerdown', { bubbles: true }), { pointerId: 2, pointerType: 'touch' }));
  const input = app.document.querySelector('[data-id="bell"] .haptic-tap input');
  app.document.querySelector('[data-id="bell"] .haptic-tap').click();
  assert.equal(bell(app), 10, '数えない（前の押下の長押し扱いで −1 にもしない）');
  assert.equal(input.checked, false, '振動しない');
});

test('セルで押し始めたタップは、スイッチが切り替わる（振動する）', async () => {
  const app = setup();
  const input = app.document.querySelector('[data-id="bell"] .haptic-tap input');
  await gesture(app, '[data-id="bell"]', ['down', 'up', 'click']);
  assert.equal(bell(app), 11);
  assert.equal(input.checked, true, 'スイッチが切り替わる＝振動する');
  await gesture(app, '[data-id="bell"]', ['down', 'cancel', 'click']); // click 補完のときも振動する
  assert.equal(bell(app), 12);
  assert.equal(input.checked, false);
});

test('タップの記録: 直近のタップで届いたイベントと結果を残す（設定画面の調査用）', async () => {
  const app = setup();
  await gesture(app, '[data-id="bell"]', ['down', 'cancel', 'click']);
  await gesture(app, '[data-id="bell"]', ['down', 'wait:350', 'up', 'click']);
  const log = app.ev('JSON.stringify(tapLog)');
  const entries = JSON.parse(log); // 新しい順
  assert.equal(entries.length, 2);
  assert.equal(entries[1].id, 'bell');
  assert.match(entries[1].ev, /down.*cancel.*click/);
  assert.equal(entries[1].result, '+1(click補完)');
  assert.equal(entries[0].result, '-1');
  assert.ok(entries[0].ms >= 300, '押していた時間も残す');
  app.window.openModal('setting-modal');
  assert.match(app.document.getElementById('tap-log').textContent, /click補完/);
});
