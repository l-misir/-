// インラインスクリプトの構文チェックと、起動時エラーが無いことの確認
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadApp, extractScript } = require('./helpers');

test('インラインスクリプトが構文エラーなくパースできる', () => {
  assert.doesNotThrow(() => new vm.Script(extractScript()));
});

test('起動時に JS エラーが出ない', () => {
  const { errors } = loadApp();
  assert.deepEqual(errors, []);
});

test('全機種で calc() が NaN を出さない', () => {
  const { ev, document, selectMachine, errors } = loadApp();
  for (const m of ['houou', 'king', 'dragon', 'star', 'newking']) {
    selectMachine(m);
    ev(`
      const d = getData();
      d.start = { g:0, b:0, r:0 }; d.hits = [];
      d.cur.g = 5000; d.cur.b = 18; d.cur.r = 12; d.cur.bell = 680;
      d.cur.suika = 12; d.cur.suikaR = 2; d.cur.retro_d = 10; d.cur.retro = 1;
      calc();
    `);
    const html = document.getElementById('predict-bars').innerHTML
      + document.getElementById('expect-info').innerHTML;
    assert.ok(!html.includes('NaN'), `${m}: 推測結果に NaN が含まれる`);
  }
  assert.deepEqual(errors, []);
});
