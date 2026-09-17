/**
 * Webアプリのエントリポイントと、画面から呼ぶ関数群。
 * デプロイ: エディタ右上「デプロイ」→「新しいデプロイ」→ 種類=ウェブアプリ。
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('セミナーリリース下書きジェネレーター')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** 手順1+2：URLからLPを取得して整理結果を返す。 */
function apiAnalyze(url) {
  const lp = fetchLpContent(url);
  const analysis = analyzeLp(lp.text, lp.url);
  return {
    lpTitle: lp.title,
    lpUrl: lp.url,
    lpTextPreview: lp.text.slice(0, 1200),
    analysis: analysis,
  };
}

/** 手順2（手入力フォールバック）：貼り付けた本文から整理結果を返す。 */
function apiAnalyzeText(text, url) {
  const analysis = analyzeLp(String(text || ''), url || '');
  return { lpTitle: '', lpUrl: url || '', lpTextPreview: String(text || '').slice(0, 1200), analysis: analysis };
}

/** 手順3：（人手修正済みの）整理結果からDocs下書きを生成する。 */
function apiGenerateDraft(analysis) {
  return generateDraft(analysis);
}
