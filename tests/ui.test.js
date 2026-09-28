// 画面操作まわり: 機種名タップ/長押し・起動時の数値表示・振動・画面遷移・テンキー桁数・ハマりG数
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

const isActive = (app, id) => app.document.getElementById(id).classList.contains('active');

test('機種名: タップでまとめて加算、長押しでダミー表示の切替', async () => {
  const app = loadApp();
  app.window.startMachinePress();
  app.window.endMachinePress();
  assert.ok(isActive(app, 'bulk-panel'), 'タップでまとめて加算が開く');
  assert.equal(app.ev('dummyMode'), false, 'タップではダミー表示は変わらない');
  app.window.closeBulkPanel();

  app.window.startMachinePress();
  await new Promise((r) => setTimeout(r, 600)); // 550ms で長押し判定
  app.window.endMachinePress();
  assert.equal(app.ev('dummyMode'), true, '長押しでダミー表示になる');
  assert.ok(!isActive(app, 'bulk-panel'), '長押しではまとめて加算は開かない');
});

test('起動時の数値表示: 設定が「隠す」なら起動直後からダミー表示', () => {
  const hidden = loadApp({ storage: { machine: 'newking', dummyDefault: true } });
  assert.equal(hidden.ev('dummyMode'), true);
  assert.equal(hidden.document.getElementById('disp-machine').style.opacity, '0.5');

  const real = loadApp({ storage: { machine: 'newking', dummyDefault: false } });
  assert.equal(real.ev('dummyMode'), false);

  const old = loadApp({ storage: { machine: 'newking' } }); // 設定追加前の保存データ
  assert.equal(old.ev('dummyMode'), false);
  assert.equal(old.ev('data.haptic'), true, '振動の初期値は ON');
});

test('起動時の数値表示: 設定を変えても今の表示は切り替わらない', () => {
  const app = loadApp();
  app.window.setDummyDefault(true);
  assert.equal(app.ev('data.dummyDefault'), true);
  assert.equal(app.ev('dummyMode'), false);
  assert.ok(app.document.getElementById('btn-dummy-hide').classList.contains('active-mode'));
});

test('振動(iPhone): ON なら各セルにスイッチ用の透明ラベルをかぶせ、OFF なら外す', () => {
  const app = loadApp();
  app.selectMachine('newking');
  const cells = () => [...app.document.querySelectorAll('#main-ui .t-btn, #main-ui .t-lamp')];
  const withSwitch = () => cells().filter((c) => c.querySelector('label.haptic-tap > input[type="checkbox"][switch]'));
  assert.ok(cells().length > 20);
  assert.equal(withSwitch().length, cells().length, 'ON: 全セルに付く');

  app.window.setHaptic(false);
  assert.equal(withSwitch().length, 0, 'OFF: 付かない');
  app.window.setHaptic(true);
  assert.equal(withSwitch().length, cells().length);
});

test('振動: ON ならセルのタップで振動、OFF なら振動しない（vibrate 対応端末）', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  let calls = 0;
  app.window.navigator.vibrate = () => { calls++; return true; };

  await app.tap('[data-id="bell"]');
  await app.tap('.t-lamp[data-type="big"][data-idx="0"]');
  assert.equal(calls, 2);
  assert.equal(app.ev('getData().cur.bell'), 1);

  app.window.setHaptic(false);
  await app.tap('[data-id="bell"]');
  assert.equal(calls, 2, 'OFF では振動しない');
  assert.equal(app.ev('getData().cur.bell'), 2);
});

test('ベルのタップ無効: 設定で「数えない」にすると、ベルのセルをタップしても増減しない', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  assert.equal(app.ev('data.bellTap'), true, '初期値は数える');
  await app.tap('[data-id="bell"]');
  assert.equal(app.ev('getData().cur.bell'), 1);

  app.window.setBellTap(false);
  assert.ok(app.document.getElementById('btn-belltap-off').classList.contains('active-mode'));
  const cell = app.document.querySelector('#main-ui [data-id="bell"]');
  assert.ok(!cell.classList.contains('t-btn'), 'タップ処理を付けない');
  assert.ok(!cell.querySelector('.haptic-tap'), '振動用ラベルも付けない');
  assert.match(cell.textContent, /タップ無効/);
  assert.equal(cell.querySelector('.value').textContent, '1');
  // 他のセルは今までどおり
  await app.tap('[data-id="suika"]');
  assert.equal(app.ev('getData().cur.suika'), 1);
  // まとめて加算では入れられる
  app.window.openBulkPanel();
  app.window.setBulkTarget('bell');
  ['5', 'ok'].forEach((k) => app.window.bulkKey(k));
  app.window.closeBulkPanel();
  assert.equal(app.ev('getData().cur.bell'), 6);
  assert.equal(app.document.querySelector('#main-ui [data-id="bell"] .value').textContent, '6');
});

test('ベルのタップ無効でも、ショートカット送信の上書きと発光は効く', async () => {
  const app = loadApp({
    storage: { machine: 'newking', bellTap: false, newking: { cur: { bell: 50 } } },
    query: '?bell=135&t=20260927153012',
  });
  await new Promise((r) => setTimeout(r, 200));
  const cell = app.document.querySelector('#main-ui [data-id="bell"]');
  assert.equal(cell.querySelector('.value').textContent, '135');
  assert.ok(cell.classList.contains('touch-active'));
});

test('BIG の色（色付きの所だけ）は赤系、REG は青のまま', () => {
  const app = loadApp();
  const css = app.document.querySelector('style').textContent;
  const rule = (sel) => (css.match(new RegExp(sel.replace(/\./g, '\\.') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
  const hue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const expand = (c) => (c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c);
  for (const sel of ['.hit-kind.big', '.hm-kind.big']) {
    const color = expand(rule(sel).match(/(?:^|;|\s)color:\s*(#[0-9a-fA-F]{3,6})/)[1]);
    const h = hue(color);
    assert.ok(h < 20 || h > 340, `${sel} は赤系（${color}）`);
  }
  assert.match(rule('.hm-kind.reg'), /color:#6cf/);
});

test('画面遷移: 🔍 → 大当たり分布 → (タイトル) → 設定推測。設定推測が手前に重なる', () => {
  const app = loadApp();
  const doc = app.document;
  doc.querySelector('.header .header-icon').click(); // 🔍
  assert.ok(isActive(app, 'hit-modal'));
  assert.ok(!isActive(app, 'predict-modal'));
  assert.match(doc.querySelector('#hit-modal .modal-title').textContent, /大当たり分布/);

  doc.querySelector('#hit-modal .modal-title').click();
  assert.ok(isActive(app, 'predict-modal'));
  // z-index が同じなので DOM の後ろにある方が手前: 大当たり分布 < 設定推測 < 実戦履歴
  const order = ['hit-modal', 'predict-modal', 'history-modal'].map((id) => doc.getElementById(id));
  assert.ok(order[0].compareDocumentPosition(order[1]) & app.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(order[1].compareDocumentPosition(order[2]) & app.window.Node.DOCUMENT_POSITION_FOLLOWING);

  doc.querySelector('#predict-modal .modal-header .header-icon:last-child').click(); // ✕
  assert.ok(!isActive(app, 'predict-modal'));
  assert.ok(isActive(app, 'hit-modal'), '✕ で大当たり分布に戻る');
});

test('テンキー外のセルをタップして閉じても、押したセルは作り直さない（タップと振動が途切れない）', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev('getData().cur.g = 300;');
  app.window.renderMain();
  await app.tap('[data-id="b"]'); // BIG → テンキー表示
  ['1', '2', '0'].forEach((k) => app.window.hitKey(k));
  const bell = app.document.querySelector('[data-id="bell"]');
  await app.tap('[data-id="bell"]'); // パネル外タップで閉じる＋ベル+1
  assert.ok(!app.document.getElementById('hit-panel').classList.contains('active'));
  assert.ok(bell.isConnected, 'ベルのセルが作り直されていない');
  assert.equal(bell.querySelector('.value').textContent, '1');
  assert.equal(app.ev('getData().cur.bell'), 1);
  // G数の表示は記録に合わせて更新される（打ち始め0 + 記録120 + ハマり0）
  assert.equal(app.document.querySelector('[data-id="g"] .value').textContent, '120');
});

test('テンキー: 大当たり回転数は4桁(9999G)まで', () => {
  const app = loadApp();
  app.selectMachine('newking');
  app.ev(`getData().hits.unshift({ g: null, k: 'b' });`);
  app.window.openHitInput('b');
  ['1', '2', '3', '4', '5'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  assert.equal(app.ev('getData().hits[0].g'), 1234);
});

test('ハマりG数: 当選後にゲーム数を足すと、前回の当たりからのG数も増える', async () => {
  const app = loadApp();
  app.selectMachine('newking');
  const hamari = () => {
    app.window.openHitModal();
    const g = app.document.querySelector('.hm-now-g').textContent;
    app.window.closeHitModal();
    return g;
  };
  // BIG を 100G で記録
  await app.tap('[data-id="b"]');
  ['1', '0', '0'].forEach((k) => app.window.hitKey(k));
  app.window.hitEditSave();
  assert.equal(hamari(), '0G');

  await app.tap('[data-id="g"]'); // +50
  assert.equal(hamari(), '50G');

  app.window.openBulkPanel(); // まとめて加算で +30
  app.window.setBulkTarget('g');
  ['3', '0', 'ok'].forEach((k) => app.window.bulkKey(k));
  app.window.closeBulkPanel();
  assert.equal(hamari(), '80G');

  app.window.setInputMode('input'); // 入力モードで現在G数を 300 に
  const input = app.document.querySelectorAll('#main-ui .val-input')[0];
  input.value = '300';
  input.dispatchEvent(new app.window.Event('change'));
  assert.equal(hamari(), '200G');
});
