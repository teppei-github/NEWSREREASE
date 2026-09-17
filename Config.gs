/**
 * 設定シートの読み込み。
 *
 * このスクリプトをコンテナバインドで作る場合は、バインド先スプレッドシートに
 * 「設定」「過去リリース」シートを用意する。スタンドアロンで作る場合は
 * スクリプトプロパティ SETTINGS_SPREADSHEET_ID に対象スプレッドシートIDを入れる。
 */

const SETTINGS_SHEET_NAME = '設定';
const PAST_RELEASE_SHEET_NAME = '過去リリース';

/** 設定シートで使うキー。ここに無いキーはスプレッドシート上で自由に増やしてよい。 */
const CONFIG_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',        // 例: gemini-2.0-flash / gemini-2.5-pro
  'DRIVE_FOLDER_ID',     // 下書きDocの保存先フォルダ（空ならマイドライブ直下）
  '会社名',
  '事業内容',
  'ミッション',
  '会社概要文',           // プレスリリース末尾に載せる定型の会社概要
  '今後の事業展開',        // 中期的な方針・ビジョン。リリース終盤の段落で使う
  '担当部署',
  '問い合わせ先',
];

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const id = PropertiesService.getScriptProperties().getProperty('SETTINGS_SPREADSHEET_ID');
  if (!id) {
    throw new Error(
      'スプレッドシートが見つかりません。コンテナバインドで作成するか、' +
      'スクリプトプロパティ SETTINGS_SPREADSHEET_ID を設定してください。'
    );
  }
  return SpreadsheetApp.openById(id);
}

/**
 * 設定シート（A列=キー, B列=値）を { キー: 値 } のオブジェクトで返す。
 */
function loadConfig() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    throw new Error('「' + SETTINGS_SHEET_NAME + '」シートがありません。setupSettingsSheet() を実行してください。');
  }
  const values = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 2).getValues();
  const config = {};
  values.forEach(function (row) {
    const key = String(row[0]).trim();
    if (!key) return;
    config[key] = typeof row[1] === 'string' ? row[1].trim() : row[1];
  });

  if (!config.GEMINI_API_KEY) {
    throw new Error('設定シートに GEMINI_API_KEY がありません。');
  }
  if (!config.GEMINI_MODEL) config.GEMINI_MODEL = 'gemini-2.0-flash';
  return config;
}

/**
 * 過去リリースシートのA列（本文）を配列で返す。文体・構成の手本として使う。
 * 1行目に見出しがあってもよい（「本文」等の短い語なら自動スキップ）。
 */
function loadPastReleases() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(PAST_RELEASE_SHEET_NAME);
  if (!sheet || sheet.getLastRow() === 0) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  return values
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (t) { return t.length > 40; }) // 見出しセルなどを除外
    .slice(0, 3);
}

/**
 * 初回セットアップ用。設定シートと過去リリースシートの雛形を作る。
 * スクリプトエディタから手動実行する。
 */
function setupSettingsSheet() {
  const ss = getSpreadsheet_();

  let s = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!s) s = ss.insertSheet(SETTINGS_SHEET_NAME);
  s.clear();
  s.getRange(1, 1, 1, 2).setValues([['キー', '値']]).setFontWeight('bold');
  const rows = CONFIG_KEYS.map(function (k) { return [k, '']; });
  s.getRange(2, 1, rows.length, 2).setValues(rows);
  s.setColumnWidth(1, 180);
  s.setColumnWidth(2, 640);
  s.getRange('B2').setNote('Google AI Studio (https://aistudio.google.com/apikey) で発行したAPIキー');
  s.getRange('B3').setNote('省略時は gemini-2.0-flash');

  let p = ss.getSheetByName(PAST_RELEASE_SHEET_NAME);
  if (!p) p = ss.insertSheet(PAST_RELEASE_SHEET_NAME);
  p.clear();
  p.getRange(1, 1).setValue('本文（1セルに1本、過去のリリース文を貼り付け）').setFontWeight('bold');
  p.setColumnWidth(1, 800);

  SpreadsheetApp.getUi().alert('「設定」「過去リリース」シートを用意しました。値を記入してください。');
}
