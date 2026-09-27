/**
 * © 2026 김용현
 *
 * e-GIS 실험실 의견 저장 — Google Apps Script 웹앱
 *
 * e-GIS 실험실 창의 「의견 보내기」(src/ui/panels/LabFeedbackPanel.js)가 보낸 답을
 * 이 스크립트가 붙어 있는 스프레드시트의 「의견」 탭에 쌓는다. 고른 기능(항목)마다 한 줄이고,
 * 한 번에 함께 보낸 줄들은 「묶음」 번호가 같다.
 * 항목에 붙인 이미지는 내 구글 드라이브의 「e-GIS 실험실 의견 이미지」 폴더에 저장하고, 그 줄에 링크를 남긴다
 * (파일은 나만 볼 수 있다 — 공유 설정을 바꾸지 않는다).
 *
 * ── 설치 (한 번만) ──────────────────────────────────────────────
 * 1. 새 구글 스프레드시트를 만든다(이름 예: e-GIS 실험실 의견).
 * 2. 메뉴 확장 프로그램 → Apps Script → 기본 코드를 지우고 이 파일 내용을 붙여 넣고 저장.
 * 3. 오른쪽 위 배포 → 새 배포 → 유형 「웹 앱」
 *      실행 계정: 나 / 액세스 권한: 모든 사용자  → 배포 → 권한 허용(시트·드라이브).
 * 4. 나온 웹 앱 URL(https://script.google.com/macros/s/…/exec)을 e-GIS 의
 *    src/labs/registry.js  FEEDBACK_ENDPOINT 에 넣는다.
 * 코드를 고친 뒤에는 배포 → 배포 관리 → 연필 → 버전 「새 버전」으로 다시 배포해야 반영된다(URL 은 그대로).
 *
 * ── 받는 형식 ──────────────────────────────────────────────────
 * POST, 본문은 JSON 문자열(Content-Type text/plain):
 *   { items: [{ experiment: string, message: string, image?: { name, type, data(base64) } }],
 *     role: string, email: string, page, ua, labsOn: string[], website(봇 막이 — 비어 있어야 함) }
 * 응답: { ok: true } 또는 { ok: false, error: '사용자에게 보일 문장' }
 */

const SHEET_NAME = '의견';
const FOLDER_NAME = 'e-GIS 실험실 의견 이미지';
const TIMEZONE = 'Asia/Seoul';
const HEADERS = ['받은 시각', '묶음', '실험 기능', '의견', '첨부 이미지', '역할', '이메일', '켜져 있던 실험', '페이지', '브라우저'];
const MAX_ITEMS = 10;

// 의견이 들어오면 알림 메일을 받을 주소 — 비우면 메일을 보내지 않는다.
// (처음 배포할 때와 메일 기능을 넣은 뒤 다시 배포할 때, 「메일 보내기」 권한을 허용해야 한다)
const NOTIFY_EMAIL = 'fkv777@gmail.com';

const MAX_MESSAGE = 3000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PER_MINUTE = 20; // 전체 기준 — 공개 주소라 폭주만 막는다

function doGet() {
  return json({ ok: true, service: 'e-GIS labs feedback' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.website) return json({ ok: true }); // 봇 — 저장하지 않고 성공처럼 돌려준다

    const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS)
      .map((it) => ({ experiment: clip(it && it.experiment, 60), message: clip(it && it.message, MAX_MESSAGE).trim(), image: it && it.image }))
      .filter((it) => it.message);
    if (!items.length) return json({ ok: false, error: '의견을 적어 주세요.' });
    if (!rateOk()) return json({ ok: false, error: '보내는 사람이 많습니다. 잠시 뒤에 다시 보내 주세요.' });

    const labsOn = (Array.isArray(body.labsOn) ? body.labsOn : []).slice(0, 20).map((x) => clip(x, 40)).join(', ');
    const role = clip(body.role, 20);
    const email = clip(body.email, 200).trim();
    const now = new Date();
    const time = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    const batch = Utilities.formatDate(now, TIMEZONE, 'MMddHHmmss') + '-' + Math.floor(Math.random() * 1000); // 함께 보낸 줄 묶음

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const rows = items.map((it) => [
        time,
        batch,
        safe(it.experiment),
        safe(it.message),
        saveImage(it.image, it.experiment),
        safe(role),
        safe(email),
        safe(labsOn),
        safe(clip(body.page, 300)),
        safe(clip(body.ua, 300)),
      ]);
      const sheet = getSheet();
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
      // 알림 메일에 쓸 값: 항목 이름·의견·이미지 링크(시트에 쓴 것 그대로)
      items.forEach((it, i) => { it.imageUrl = rows[i][4]; });
    } finally {
      lock.releaseLock();
    }
    notify(items, { time, batch, role, email, labsOn, page: clip(body.page, 300) });
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: '저장하지 못했습니다. 잠시 뒤에 다시 보내 주세요.' });
  }
}

/**
 * 알림 메일 — 저장이 끝난 뒤 보낸다. 메일이 실패해도 저장은 이미 됐으므로 사용자에게는 성공으로 돌려준다.
 * 의견을 보낸 사람이 이메일을 적었으면 답장(Reply-To)이 그 주소로 가게 한다.
 */
function notify(items, meta) {
  if (!NOTIFY_EMAIL) return;
  try {
    const names = items.map((it) => it.experiment || '(기능 없음)');
    const subject = '[e-GIS 실험실 의견] ' + names[0] + (names.length > 1 ? ' 외 ' + (names.length - 1) + '건' : '');
    const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

    const text = items.map((it) =>
      '■ ' + it.experiment + '\n' + it.message + (it.imageUrl ? '\n첨부 이미지: ' + it.imageUrl : '')
    ).join('\n\n') +
      '\n\n역할: ' + (meta.role || '-') + ' / 이메일: ' + (meta.email || '-') +
      '\n켜져 있던 실험: ' + (meta.labsOn || '-') + '\n받은 시각: ' + meta.time + ' (묶음 ' + meta.batch + ')' +
      '\n\n스프레드시트: ' + sheetUrl;

    const html = items.map((it) =>
      '<h3 style="margin:16px 0 4px;font-size:15px">' + esc(it.experiment) + '</h3>' +
      '<p style="margin:0;white-space:pre-wrap">' + esc(it.message) + '</p>' +
      (it.imageUrl && /^https:/.test(it.imageUrl) ? '<p style="margin:4px 0 0"><a href="' + esc(it.imageUrl) + '">첨부 이미지 보기</a></p>' : '')
    ).join('') +
      '<hr style="margin:16px 0;border:none;border-top:1px solid #ddd">' +
      '<p style="margin:0;color:#555;font-size:13px">역할: ' + esc(meta.role || '-') + ' · 이메일: ' + esc(meta.email || '-') + '<br>' +
      '켜져 있던 실험: ' + esc(meta.labsOn || '-') + '<br>받은 시각: ' + esc(meta.time) + ' (묶음 ' + esc(meta.batch) + ')</p>' +
      '<p style="margin:12px 0 0"><a href="' + esc(sheetUrl) + '">스프레드시트에서 보기</a></p>';

    const options = { name: 'e-GIS 실험실', htmlBody: html };
    if (meta.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(meta.email)) options.replyTo = meta.email;
    MailApp.sendEmail(NOTIFY_EMAIL, subject, text, options);
  } catch (err) {
    console.error('알림 메일 실패', err);
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 첨부 이미지를 드라이브 폴더에 저장하고 링크를 돌려준다. 없거나 잘못되면 '' */
function saveImage(image, experiment) {
  if (!image || !image.data) return '';
  const type = /^image\/(png|jpeg|webp|gif)$/.test(image.type) ? image.type : 'image/jpeg';
  const bytes = Utilities.base64Decode(String(image.data));
  if (bytes.length > MAX_IMAGE_BYTES) return '(이미지가 너무 커서 저장하지 않음)';
  const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss');
  const name = (stamp + '-' + clip(experiment, 30) + '-' + clip(image.name, 60)).replace(/[\\/:*?"<>|]/g, '_');
  const file = getFolder().createFile(Utilities.newBlob(bytes, type, name));
  return file.getUrl();
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

/** 폴더 ID 는 스크립트 속성에 기억한다(이름이 같은 폴더가 여러 개 생기지 않게) */
function getFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* 지워졌으면 새로 만든다 */ }
  }
  const folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

/** 1분에 MAX_PER_MINUTE 건까지 */
function rateOk() {
  const cache = CacheService.getScriptCache();
  const key = 'rate-' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(key) || 0);
  if (n >= MAX_PER_MINUTE) return false;
  cache.put(key, String(n + 1), 120);
  return true;
}

function clip(v, n) {
  return String(v == null ? '' : v).slice(0, n);
}

/** 수식으로 해석되지 않게(=, +, -, @ 로 시작하면 ' 를 붙인다) */
function safe(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
