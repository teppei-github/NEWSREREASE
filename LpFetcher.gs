/**
 * セミナーLPのURLからHTMLを取得し、本文テキストを抽出する。
 */

/**
 * @param {string} url
 * @return {{url:string, title:string, text:string, html:string}}
 */
function fetchLpContent(url) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('URLは http(s):// から始まる形式で入力してください。');
  }

  const res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });

  const code = res.getResponseCode();
  if (code >= 400) {
    throw new Error('LPの取得に失敗しました (HTTP ' + code + ')。URLを確認するか、本文テキストを直接貼り付けてください。');
  }

  const html = res.getContentText();
  return {
    url: url,
    title: extractTitle_(html),
    text: htmlToText_(html),
    html: html,
  };
}

function extractTitle_(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return decodeEntities_(m[1].replace(/\s+/g, ' ').trim());
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  return og ? decodeEntities_(og[1].trim()) : '';
}

/**
 * ざっくりHTML→プレーンテキスト。script/style/nav/footer等を落とし、
 * ブロック要素を改行に変換する。GAS標準機能のみ（XmlServiceは壊れたHTMLで失敗するため未使用）。
 */
function htmlToText_(html) {
  let s = html;

  // メタ情報として先に説明文を拾っておく
  const desc = s.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|template|svg|iframe)[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(header|nav|footer|aside)[\s\S]*?<\/\1>/gi, ' ');

  // 改行にしたいブロック境界
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|br|ul|ol|table|dd|dt)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '\n・');

  // 残りのタグを除去
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities_(s);

  // 空白・空行の整理
  s = s.replace(/[ \t　]+/g, ' ');
  s = s.replace(/ *\n */g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();

  if (desc) s = '（ページ説明）' + decodeEntities_(desc[1]) + '\n\n' + s;

  // Geminiに渡しすぎないよう上限
  const MAX = 18000;
  if (s.length > MAX) s = s.slice(0, MAX) + '\n…（以下省略）';
  return s;
}

function decodeEntities_(str) {
  return String(str)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); });
}
