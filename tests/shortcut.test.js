// iOS ショートカットからのベル上書き（index.html?bell=N&t=送信日時）と、複数タブ対策
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers');

// ニューキングⅤ・ベル50 の保存データ
function saved(extra = {}) {
  return {
    machine: 'newking',
    newking: { cur: { g: 1000, b: 3, r: 2, bell: 50 } },
    ...extra,
  };
}
const stored = (app) => JSON.parse(app.window.localStorage.getItem('hana_v20_data'));
// 送信の適用は画面を表示してから確認ダイアログを出すので、少し待つ
const settle = () => new Promise((r) => setTimeout(r, 200));
const load = async (opts) => { const app = loadApp(opts); await settle(); return app; };

test('送信: 上書き前に「120→135」の確認を出し、キャンセルなら上書きしない', async () => {
  const msgs = [];
  const app = loadApp({
    storage: saved(),
    query: '?bell=135&t=20260927153012',
    beforeStartup(window) { window.confirm = (m) => { msgs.push(m); return false; }; },
  });
  assert.ok(app.document.querySelectorAll('#main-ui .cell').length > 10, '確認の前に画面は表示済み');
  await settle();
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /50 → 135/);
  assert.equal(app.ev('getData().cur.bell'), 50);
  assert.equal(stored(app).newking.cur.bell, 50);
  assert.equal(app.window.location.search, '', 'キャンセルしても URL は消す');
});

test('送信: 確認でOKしたのに保存に失敗したら、上書きを取り消して元の値に戻す', async () => {
  const app = await load({
    storage: saved({ lastBellSyncT: '20260927120000' }),
    query: '?bell=135&t=20260927153012',
    setup(window) {
      const orig = window.Storage.prototype.setItem;
      window.Storage.prototype.setItem = function (k, v) {
        if (k === 'hana_v20_data' && window.__failSave) throw new Error('QuotaExceededError');
        return orig.call(this, k, v);
      };
    },
    beforeStartup(window) { window.__failSave = true; },
  });
  assert.equal(app.ev('getData().cur.bell'), 50, '内部値も元に戻す');
  assert.equal(app.ev('data.lastBellSyncT'), '20260927120000');
  assert.equal(app.document.querySelector('#main-ui [data-id="bell"] .value').textContent, '50');
  assert.equal(app.window.location.search, '?bell=135&t=20260927153012', 'URL は残す（再読込で送り直せる）');
  // 保存できるようになってから他をタップしても、ベルは 50 のまま保存される
  app.window.__failSave = false;
  await app.tap('[data-id="g"]');
  assert.equal(stored(app).newking.cur.bell, 50);
});

test('送信: 今のベルと同じ値なら確認を出さない', async () => {
  let asked = 0;
  const app = loadApp({
    storage: saved(),
    query: '?bell=50&t=20260927153012',
    beforeStartup(window) { window.confirm = () => { asked++; return true; }; },
  });
  await settle();
  assert.equal(asked, 0);
  assert.equal(app.ev('data.lastBellSyncT'), '20260927153012');
});

test('送信: ベルを送った値で上書きし、URL から消して、セルを光らせる', async () => {
  const app = await load({ storage: saved(), query: '?bell=135&t=20260927153012' });
  assert.equal(app.ev('getData().cur.bell'), 135);
  assert.equal(stored(app).newking.cur.bell, 135);
  assert.equal(stored(app).lastBellSyncT, '20260927153012');
  assert.equal(app.window.location.search, '', '再読込で上書きし直さないよう URL から消す');
  const cell = app.document.querySelector('#main-ui [data-id="bell"]');
  assert.equal(cell.querySelector('.value').textContent, '135');
  assert.ok(cell.classList.contains('touch-active'), '上書きしたベルのセルが光る');
  assert.equal(app.ev('getData().cur.g'), 1000, 'ベル以外は変えない');
});

test('送信: 前回より古い送信日時の URL は無視する', async () => {
  const app = await load({
    storage: saved({ lastBellSyncT: '20260927160000' }),
    query: '?bell=135&t=20260927153012',
  });
  assert.equal(app.ev('getData().cur.bell'), 50);
  assert.equal(app.window.location.search, '');
});

test('送信: 同じ日時の URL をもう一度開いても上書きしない（タップで足した分を消さない）', async () => {
  const app = await load({
    storage: saved({ lastBellSyncT: '20260927153012' }),
    query: '?bell=135&t=20260927153012',
  });
  assert.equal(app.ev('getData().cur.bell'), 50);
});

test('送信: 送信日時が無くても上書きする。末尾の改行は無視、不正な値は無視', async () => {
  assert.equal((await load({ storage: saved(), query: '?bell=37' })).ev('getData().cur.bell'), 37);
  assert.equal((await load({ storage: saved(), query: '?bell=37%0A' })).ev('getData().cur.bell'), 37);
  assert.equal((await load({ storage: saved(), query: '?bell=0' })).ev('getData().cur.bell'), 0);
  const bad = await load({ storage: saved(), query: '?bell=abc' });
  assert.equal(bad.ev('getData().cur.bell'), 50);
  assert.equal(bad.window.location.search, '');
  assert.equal((await load({ storage: saved(), query: '?bell=-3' })).ev('getData().cur.bell'), 50);
});

test('送信: bell は0以上の整数だけ受け付ける（途中まで数字の値は無視）', async () => {
  for (const q of ['135abc', '37.9', '-0.5', '1,234', '9'.repeat(310), '', '%20']) {
    const app = await load({ storage: saved(), query: `?bell=${q}&t=20260927153012` });
    assert.equal(app.ev('getData().cur.bell'), 50, `bell=${q} は無視`);
    assert.equal(app.window.location.search, '');
  }
});

test('送信: 形式の違う t は日時なし扱い。一度入っても以後の正しい送信を止めない', async () => {
  const app = await load({ storage: saved(), query: '?bell=135&t=garbage' });
  assert.equal(app.ev('getData().cur.bell'), 135);
  assert.equal(app.ev('data.lastBellSyncT'), undefined);
  // 以前の版で不正な値が保存されてしまっていても回復する
  const app2 = await load({ storage: saved({ lastBellSyncT: 'garbage' }), query: '?bell=150&t=20260928120000' });
  assert.equal(app2.ev('getData().cur.bell'), 150);
  assert.equal(app2.ev('data.lastBellSyncT'), '20260928120000');
});

test('送信: 入力モードでも、上書きしたベルのセルを光らせる', async () => {
  const app = await load({ storage: saved({ mode: 'input' }), query: '?bell=135&t=20260927153012' });
  const cell = app.document.querySelector('#main-ui [data-id="bell"]');
  assert.ok(cell, '入力モードでもベルのセルを特定できる');
  assert.equal(cell.querySelector('input').value, '135');
  assert.ok(cell.classList.contains('touch-active'));
});

test('送信: 保存に失敗しても画面は表示し、URL は残す（再読込で送り直せる）', async () => {
  const app = await load({
    storage: saved(),
    query: '?bell=135&t=20260927153012',
    setup(window) {
      const orig = window.Storage.prototype.setItem;
      window.Storage.prototype.setItem = function (k, v) {
        if (k === 'hana_v20_data' && window.__failSave) throw new Error('QuotaExceededError');
        return orig.call(this, k, v);
      };
      window.__failSave = true;
    },
  });
  assert.ok(app.document.querySelectorAll('#main-ui .cell').length > 10, 'メイン画面は表示される');
  assert.equal(app.window.location.search, '?bell=135&t=20260927153012');
  assert.equal(JSON.parse(app.window.localStorage.getItem('hana_v20_data')).newking.cur.bell, 50);
});

test('起動: 使用権を取った後に保存データを読み直す（読み込み〜起動の間に別タブが保存した分を失わない）', () => {
  const app = loadApp({
    storage: saved(),
    beforeStartup(window) {
      // このタブのスクリプトが古いデータ(ベル50)を読んだ後、起動処理の前に別タブがベル135・G1200を保存した
      const newer = saved();
      newer.newking.cur.bell = 135;
      newer.newking.cur.g = 1200;
      window.localStorage.setItem('hana_v20_data', JSON.stringify(newer));
      window.localStorage.setItem('hana_active_tab', 'other-tab');
    },
  });
  assert.equal(app.ev('getData().cur.bell'), 135);
  assert.equal(app.ev('getData().cur.g'), 1200);
});

test('起動: 起動処理の前に前面復帰の確認が走っても、新しいタブを古いタブ扱いしない', () => {
  const app = loadApp({
    storage: saved(),
    beforeStartup(window) {
      window.localStorage.setItem('hana_active_tab', 'older-tab');
      window.document.dispatchEvent(new window.Event('visibilitychange'));
    },
  });
  assert.ok(!app.document.getElementById('stale-tab').classList.contains('active'));
});

test('送信: bell の上限は安全な整数まで', async () => {
  const ok = await load({ storage: saved(), query: '?bell=9007199254740991' });
  assert.equal(ok.ev('getData().cur.bell'), 9007199254740991);
  const ng = await load({ storage: saved(), query: '?bell=9007199254740992' });
  assert.equal(ng.ev('getData().cur.bell'), 50);
});

test('送信: 日時なし・不正な日時で上書きしたら、保存済みの送信日時は消す', async () => {
  for (const q of ['?bell=135', '?bell=135&t=garbage']) {
    const app = await load({ storage: saved({ lastBellSyncT: '20260927160000' }), query: q });
    assert.equal(app.ev('getData().cur.bell'), 135, q);
    assert.equal(app.ev('data.lastBellSyncT'), undefined, q);
    assert.equal(stored(app).lastBellSyncT, undefined, q);
  }
});

test('起動: 保存データの読み直しは、使用権を取った後に行う', () => {
  const app = loadApp({
    storage: saved(),
    setup(window) {
      // 起動処理中に hana_v20_data を読んだ時点で、使用権を持っていたかを記録
      const orig = window.Storage.prototype.getItem;
      window.__reads = [];
      window.Storage.prototype.getItem = function (k) {
        if (k === 'hana_v20_data' && window.__inStartup) window.__reads.push(orig.call(this, 'hana_active_tab'));
        return orig.call(this, k);
      };
    },
    beforeStartup(window) {
      window.localStorage.setItem('hana_active_tab', 'other-tab');
      window.__inStartup = true;
    },
  });
  const myId = app.ev('MY_TAB_ID');
  assert.ok(app.window.__reads.length > 0, '起動処理で保存データを読み直している');
  assert.deepEqual(app.window.__reads, app.window.__reads.map(() => myId));
});

test('起動: 起動処理は1回だけ（あとで呼ばれても、別タブに移った使用権を取り返さない）', async () => {
  const app = loadApp({ storage: saved() });
  app.window.localStorage.setItem('hana_active_tab', 'newer-tab');
  app.window.startup(); // 二重に呼ばれた想定
  assert.equal(app.window.localStorage.getItem('hana_active_tab'), 'newer-tab');
  await app.tap('[data-id="bell"]');
  assert.equal(stored(app).newking.cur.bell, 50);
});

test('送信: 上書きするのは選択中の機種のベルだけ', async () => {
  const app = await load({
    storage: saved({ king: { cur: { g: 500, b: 1, r: 1, bell: 70 } } }),
    query: '?bell=135&t=20260927153012',
  });
  assert.equal(app.ev('data.newking.cur.bell'), 135);
  assert.equal(app.ev('data.king.cur.bell'), 70);
});

test('送信後もアプリでベルをタップできる（次の送信で上書きされる）', async () => {
  const app = await load({ storage: saved(), query: '?bell=135&t=20260927153012' });
  await app.tap('[data-id="bell"]');
  assert.equal(app.ev('getData().cur.bell'), 136);
  assert.equal(stored(app).newking.cur.bell, 136);
});

test('複数タブ: 新しいタブが開いたら、古いタブは保存せず「閉じてください」を出す', async () => {
  const app = loadApp({ storage: saved() });
  assert.ok(!app.document.getElementById('stale-tab').classList.contains('active'));

  // 別のタブ（ショートカットの送信で開いた新しいタブ）が使えるタブになった
  app.window.localStorage.setItem('hana_active_tab', 'newer-tab');
  await app.tap('[data-id="bell"]');
  assert.equal(stored(app).newking.cur.bell, 50, '古いタブからは保存しない');
  assert.ok(app.document.getElementById('stale-tab').classList.contains('active'));
});

test('複数タブ: 古いタブが前面に戻った時点で案内を出す', () => {
  const app = loadApp({ storage: saved() });
  app.window.localStorage.setItem('hana_active_tab', 'newer-tab');
  app.document.dispatchEvent(new app.window.Event('visibilitychange'));
  assert.ok(app.document.getElementById('stale-tab').classList.contains('active'));
});
