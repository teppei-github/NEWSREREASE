/**
 * 手順3：整理結果 + 会社情報 + 過去リリースから、リリース文の下書きを作り Google Docs に書き出す。
 */

/**
 * @param {Object} analysis  analyzeLp() の結果（Web側で人手修正済みの想定）
 * @return {{docId:string, docUrl:string, title:string, markdown:string}}
 */
function generateDraft(analysis) {
  const config = loadConfig();
  const past = loadPastReleases();

  const companyBlock = [
    '会社名: ' + (config['会社名'] || '(未設定)'),
    '事業内容: ' + (config['事業内容'] || '(未設定)'),
    'ミッション: ' + (config['ミッション'] || '(未設定)'),
    '今後の事業展開: ' + (config['今後の事業展開'] || '(未設定)'),
    '会社概要文（末尾掲載用）: ' + (config['会社概要文'] || '(未設定)'),
    '担当部署: ' + (config['担当部署'] || '(未設定)'),
    '問い合わせ先: ' + (config['問い合わせ先'] || '(未設定)'),
  ].join('\n');

  const pastBlock = past.length
    ? past.map(function (t, i) { return '--- 過去リリース ' + (i + 1) + ' ---\n' + t; }).join('\n\n')
    : '(過去リリースの登録なし。一般的なPRTIMES形式で作成)';

  const prompt = [
    'あなたは日本企業の広報担当者です。以下の情報をもとに、PRTIMESに掲載する',
    'セミナー開催のニュースリリース下書きをMarkdownで作成してください。',
    '',
    '# 必須要件',
    '- 開催目的が明確に伝わること。',
    '- 「なぜ当社がこのセミナーを開催するのか」を、事業内容・ミッションと結びつけて説明すること。',
    '- 「今後の事業展開」に触れる段落を終盤に入れること。',
    '- 事実（日時・会場・料金・定員・URL・登壇者）は与えられた情報のみ使用し、創作しない。',
    '  不明な箇所は 【要確認：〇〇】 と明記する。',
    '- 過去リリースがある場合は、その文体・語彙・見出しの付け方・段落の長さに合わせる。',
    '',
    '# 構成（Markdown見出しで）',
    '1. タイトル（30〜45字程度、キャッチーかつ具体的に）',
    '2. リード文（3〜4文。要点を先に）',
    '3. 開催の背景・目的',
    '4. なぜ当社が開催するのか（事業との関連）',
    '5. セミナー概要（箇条書き：日時／形式／会場／参加費／定員／申込先／締切）',
    '6. こんなことが学べます（箇条書き）',
    '7. こんな方におすすめ（ターゲット層／箇条書き）',
    '8. 登壇者（いれば）',
    '9. 今後の事業展開',
    '10. 会社概要（設定の会社概要文をベースに整形）',
    '11. 本件に関するお問い合わせ',
    '',
    '# 会社情報',
    companyBlock,
    '',
    '# 整理済みのセミナー情報（JSON）',
    JSON.stringify(analysis, null, 2),
    '',
    '# 過去リリース（文体の手本）',
    pastBlock,
  ].join('\n');

  const markdown = callGemini(prompt, { temperature: 0.7 });

  const title =
    (analysis.theme ? analysis.theme + '｜' : '') +
    'セミナー開催リリース（下書き ' +
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd') + '）';

  const doc = DocumentApp.create(title);
  writeMarkdownToDoc_(doc, markdown);
  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  if (config.DRIVE_FOLDER_ID) {
    try {
      const folder = DriveApp.getFolderById(config.DRIVE_FOLDER_ID);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch (e) {
      // フォルダIDが不正でもDoc自体は残す
    }
  }

  return {
    docId: doc.getId(),
    docUrl: doc.getUrl(),
    title: title,
    markdown: markdown,
  };
}

/**
 * 簡易Markdown → Google Docs 整形。
 * 対応: #〜###### 見出し, - / ・ 箇条書き, 1. 番号付き, **太字**, 水平線 ---, 空行。
 */
function writeMarkdownToDoc_(doc, markdown) {
  const body = doc.getBody();
  body.clear();
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');

  lines.forEach(function (line) {
    const raw = line.replace(/\s+$/, '');

    if (!raw.trim()) { body.appendParagraph(''); return; }

    if (/^---+$/.test(raw.trim())) { body.appendHorizontalRule(); return; }

    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const p = body.appendParagraph(stripInlineMd_(h[2]));
      const map = {
        1: DocumentApp.ParagraphHeading.HEADING1,
        2: DocumentApp.ParagraphHeading.HEADING2,
        3: DocumentApp.ParagraphHeading.HEADING3,
        4: DocumentApp.ParagraphHeading.HEADING4,
        5: DocumentApp.ParagraphHeading.HEADING5,
        6: DocumentApp.ParagraphHeading.HEADING6,
      };
      p.setHeading(map[level]);
      applyBold_(p, h[2]);
      return;
    }

    const bullet = raw.match(/^\s*(?:[-*・]|•)\s+(.*)$/);
    if (bullet) {
      const item = body.appendListItem(stripInlineMd_(bullet[1]));
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      applyBold_(item, bullet[1]);
      return;
    }

    const numbered = raw.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      const item = body.appendListItem(stripInlineMd_(numbered[1]));
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      applyBold_(item, numbered[1]);
      return;
    }

    const p = body.appendParagraph(stripInlineMd_(raw));
    applyBold_(p, raw);
  });
}

function stripInlineMd_(s) {
  return String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}

/** **bold** 区間を太字にする */
function applyBold_(element, originalText) {
  const editable = element.editAsText ? element.editAsText() : null;
  if (!editable) return;
  const plain = stripInlineMd_(originalText);
  const re = /\*\*(.+?)\*\*/g;
  let m;
  while ((m = re.exec(originalText)) !== null) {
    const inner = m[1];
    const idx = plain.indexOf(inner);
    if (idx >= 0) {
      try { editable.setBold(idx, idx + inner.length - 1, true); } catch (e) {}
    }
  }
}
