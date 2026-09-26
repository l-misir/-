// ============================================================
// ハナハナカウンター GAS連携スクリプト (完全版)
// 機能: 履歴取得 / 生データ保存
//
// 【デプロイ手順】
// 1. スプレッドシート → 拡張機能 → Apps Script
// 2. このコードを全て貼り付けて保存
// 3. デプロイ → 新しいデプロイ → ウェブアプリ
//    - 実行するユーザー: 自分
//    - アクセスできるユーザー: 全員
// 4. URLをコピーしてカウンターアプリの設定に貼り付け
//
// 【更新時】デプロイを管理 → ✏️ → 新バージョン → デプロイ（URLは変わらない）
// ============================================================

const TOKEN = 'hanahana2026';  // ← アプリ設定のトークンと一致させる

const KNOWN_SHEETS = [
  'ハナハナホウオウ天翔',
  'キングハナハナ',
  'ドラゴンハナハナ閃光',
  'スターハナハナ',
  'ニューキングハナハナⅤ'
];

function doGet(e) {
  try {
    if (e.parameter.token !== TOKEN) return respond_({ error: 'unauthorized' });
    const action = e.parameter.action || 'getAll';

    // 全履歴取得
    if (action === 'getAll') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const result = [];
      KNOWN_SHEETS.forEach(name => {
        const sheet = ss.getSheetByName(name);
        if (!sheet) return;
        const values = sheet.getDataRange().getValues();
        if (values.length < 2) return;
        for (let i = 1; i < values.length; i++) {
          const row = values[i];
          if (!row[1] && row[1] !== 0) continue;
          if (typeof row[2] !== 'number' && isNaN(Number(row[2]))) continue;
          result.push({
            sheet: name,
            row: i + 1,
            values: row.map(v => v instanceof Date
              ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm')
              : v)
          });
        }
      });
      return respond_({ success: true, data: result });
    }

    // 履歴行の削除
    if (action === 'delete') {
      const sheetName = e.parameter.sheet;
      const rowNum = parseInt(e.parameter.row);
      if (!sheetName || !rowNum || rowNum < 2) return respond_({ error: 'invalid params' });
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return respond_({ error: 'sheet not found' });
      if (rowNum > sheet.getLastRow()) return respond_({ error: 'row not found' });
      sheet.deleteRow(rowNum);
      return respond_({ success: true });
    }

    return respond_({ error: 'unknown action' });
  } catch (err) {
    return respond_({ error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.token !== TOKEN) return respond_({ error: 'unauthorized' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 実戦データ追記
    let sheet = ss.getSheetByName(payload.sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(payload.sheetName);
      if (payload.headers && payload.headers.length) {
        sheet.appendRow(payload.headers);
        sheet.setFrozenRows(1);
      }
    }
    sheet.appendRow(payload.rowData);
    return respond_({ success: true, sheet: payload.sheetName, row: sheet.getLastRow() });
  } catch (err) {
    return respond_({ error: err.message });
  }
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

