/**
 * 手順2：LP本文から「内容の整理」を行う。
 * 出力は下書き生成でそのまま使える構造化オブジェクト。
 */

/**
 * @param {string} lpText  LP本文（fetchLpContent().text など）
 * @param {string} [lpUrl]
 * @return {Object} 整理結果（下記スキーマ）
 */
function analyzeLp(lpText, lpUrl) {
  const schema = [
    '{',
    '  "theme": "セミナーのテーマ（1行）",',
    '  "summary": "セミナー内容の要約（3〜4文）",',
    '  "overview": {',
    '    "dateTime": "開催日時（例: 2026年10月15日（水）14:00〜16:00）。不明なら空文字",',
    '    "location": "会場名・住所。オンラインのみなら空文字",',
    '    "format": "オンライン / オフライン / ハイブリッド のいずれか。不明なら空文字",',
    '    "fee": "参加費（例: 無料）。不明なら空文字",',
    '    "capacity": "定員。不明なら空文字",',
    '    "applicationUrl": "申込先URL。LP自体が申込ページならそのURL",',
    '    "deadline": "申込締切。不明なら空文字"',
    '  },',
    '  "targetAudience": ["想定ターゲット層を短いフレーズで2〜4個"],',
    '  "learnings": ["「こんなことが学べます」を3〜5個。LP記載を優先し、無ければ内容から具体的に補う"],',
    '  "speakers": [{"name": "登壇者名", "title": "肩書・所属"}],',
    '  "keywords": ["リリースで使えるキーワードを3〜6個"],',
    '  "missingInfo": ["LPから読み取れず、人手で埋める必要がある項目"]',
    '}',
  ].join('\n');

  const prompt = [
    'あなたはBtoBセミナーの広報担当です。以下のセミナーLP本文を読み、',
    'ニュースリリース作成のための情報を整理してください。',
    '',
    '# 制約',
    '- 出力は指定JSONのみ。前後に説明文やコードフェンスを付けない。',
    '- LPに明記されていない事実を創作しない。不明な項目は空文字または空配列にし、missingInfo に列挙する。',
    '- 日付・時刻・料金・定員・URLは本文の表記を尊重してそのまま転記する。',
    '',
    '# 出力JSONスキーマ',
    schema,
    '',
    lpUrl ? '# LPのURL\n' + lpUrl + '\n' : '',
    '# LP本文',
    lpText,
  ].join('\n');

  const result = callGemini(prompt, { json: true, temperature: 0.2 });

  // 欠損キーを埋めて後段を安全にする
  result.overview = result.overview || {};
  result.targetAudience = result.targetAudience || [];
  result.learnings = result.learnings || [];
  result.speakers = result.speakers || [];
  result.keywords = result.keywords || [];
  result.missingInfo = result.missingInfo || [];
  if (lpUrl && !result.overview.applicationUrl) result.overview.applicationUrl = lpUrl;
  return result;
}
