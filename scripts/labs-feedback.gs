/**
 * © 2026 김용현
 *
 * e-GIS 실험실 의견 저장 — Google Apps Script 웹앱
 *
 * e-GIS 실험실 창의 「의견 보내기」(src/ui/panels/LabFeedbackPanel.js)가 보낸 답을
 * 이 스크립트가 붙어 있는 스프레드시트의 「의견」 탭에 한 줄씩 쌓는다.
 * 첨부 이미지는 내 드라이브의 「e-GIS 실험실 의견 이미지」 폴더에 저장하고 시트에는 링크를 남긴다
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
 *   { experiments: string[], message: string, role: string, email: string,
 *     image?: { name, type, data(base64) }, page, ua, labsOn: string[], website(봇 막이 — 비어 있어야 함) }
 * 응답: { ok: true } 또는 { ok: false, error: '사용자에게 보일 문장' }
 */

const SHEET_NAME = '의견';
const FOLDER_NAME = 'e-GIS 실험실 의견 이미지';
const TIMEZONE = 'Asia/Seoul';
const HEADERS = ['받은 시각', '실험 기능', '의견', '역할', '이메일', '첨부 이미지', '켜져 있던 실험', '페이지', '브라우저'];

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

    const message = clip(body.message, MAX_MESSAGE).trim();
    if (!message) return json({ ok: false, error: '의견을 적어 주세요.' });
    if (!rateOk()) return json({ ok: false, error: '보내는 사람이 많습니다. 잠시 뒤에 다시 보내 주세요.' });

    const experiments = (Array.isArray(body.experiments) ? body.experiments : []).slice(0, 10).map((x) => clip(x, 60));
    const labsOn = (Array.isArray(body.labsOn) ? body.labsOn : []).slice(0, 20).map((x) => clip(x, 40));
    const email = clip(body.email, 200).trim();

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const imageUrl = saveImage(body.image);
      getSheet().appendRow([
        Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
        safe(experiments.join(', ')),
        safe(message),
        safe(clip(body.role, 20)),
        safe(email),
        imageUrl,
        safe(labsOn.join(', ')),
        safe(clip(body.page, 300)),
        safe(clip(body.ua, 300)),
      ]);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: '저장하지 못했습니다. 잠시 뒤에 다시 보내 주세요.' });
  }
}

/** 첨부 이미지를 드라이브 폴더에 저장하고 링크를 돌려준다. 없거나 잘못되면 '' */
function saveImage(image) {
  if (!image || !image.data) return '';
  const type = /^image\/(png|jpeg|webp|gif)$/.test(image.type) ? image.type : 'image/jpeg';
  const bytes = Utilities.base64Decode(String(image.data));
  if (bytes.length > MAX_IMAGE_BYTES) return '(이미지가 너무 커서 저장하지 않음)';
  const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd-HHmmss');
  const name = stamp + '-' + clip(image.name, 80).replace(/[\\/:*?"<>|]/g, '_');
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
