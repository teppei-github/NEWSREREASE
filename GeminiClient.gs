/**
 * Gemini API (Generative Language API) クライアント。
 * APIキーは設定シートの GEMINI_API_KEY を使用。
 */

/**
 * @param {string} prompt  ユーザープロンプト
 * @param {Object} [opts]
 * @param {string} [opts.systemInstruction]
 * @param {boolean} [opts.json]  true なら JSON で返すよう要求し、パース済みオブジェクトを返す
 * @param {number} [opts.temperature]
 * @return {string|Object}
 */
function callGemini(prompt, opts) {
  opts = opts || {};
  const config = loadConfig();
  const model = config.GEMINI_MODEL;
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) +
    ':generateContent?key=' +
    encodeURIComponent(config.GEMINI_API_KEY);

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature != null ? opts.temperature : 0.7,
      maxOutputTokens: 8192,
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }
  if (opts.json) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const raw = res.getContentText();
  if (code >= 400) {
    throw new Error('Gemini APIエラー (HTTP ' + code + '): ' + raw.slice(0, 500));
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('Gemini応答のJSONパースに失敗: ' + raw.slice(0, 500));
  }

  const cand = parsed.candidates && parsed.candidates[0];
  if (!cand || !cand.content || !cand.content.parts) {
    throw new Error('Geminiが空の応答を返しました: ' + raw.slice(0, 500));
  }
  const text = cand.content.parts.map(function (p) { return p.text || ''; }).join('');

  if (!opts.json) return text;

  try {
    return JSON.parse(stripCodeFence_(text));
  } catch (e) {
    throw new Error('Geminiが不正なJSONを返しました:\n' + text.slice(0, 800));
  }
}

function stripCodeFence_(text) {
  return String(text)
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}
