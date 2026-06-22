/**
 * 통합 조회수 카운터 (Unified Viewership Counter) — Google Apps Script Web App
 *
 * 한 스크립트 · 한 스프레드시트로 여러 사이트(탭)를 처리합니다.
 *  - GeoSource → 'GeoSource' 탭
 *  - e-GIS     → 'egis' 탭
 * 각 탭 구조는 [date, count] 2컬럼, 하루 1행 누적.
 *
 * 호출 규약:
 *   GET ?sheet=<탭이름>&action=read|count
 *     - sheet  : 기록할 탭. ALLOWED_SHEETS 안의 값만 허용(없거나 허용 외 값이면 DEFAULT_SHEET).
 *     - action : 'read'(조회만, 증가 X) | 'count'(오늘 +1 후 조회)
 *   예) ?sheet=egis&action=count   ?sheet=viewership&action=read
 * 응답: { today: <number>, total: <number> }
 *
 * 배포: 배포 → 웹 앱 (실행: 본인 / 액세스: 모든 사용자)
 * 코드 수정 후에는 "배포 관리 → 새 버전"으로 재배포해야 반영됩니다.
 */

const SPREADSHEET_ID = '1HoA2-Y3gayvg3Yh-gkwfeb0qZ-pb0XIDMcbzyHTP-QY'; // 공유 스프레드시트 ID (비우면 활성 시트)
const DEFAULT_SHEET = 'GeoSource';             // sheet 미지정 시 기본 탭
const ALLOWED_SHEETS = ['GeoSource', 'egis'];  // 허용 탭(공개 URL로 임의 탭 생성되는 것 방지)
const TIMEZONE = 'Asia/Seoul';

// 사용할 스프레드시트 핸들 (ID 지정 시 openById, 아니면 활성 시트)
function getSpreadsheet() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

// 시트 셀 값(Date 또는 String)을 KST 기준 'yyyy-MM-dd'로 정규화.
// Sheets가 'yyyy-MM-dd' 문자열을 자동으로 Date 객체로 변환·저장하면서
// 시간대 차이로 비교가 어긋나는 문제를 막기 위해 양쪽 모두를 같은 포맷으로 환원.
function normalizeDateCell(d) {
  if (d === null || d === undefined || d === '') return '';
  if (d instanceof Date) {
    return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
  }
  const s = String(d).trim();
  // 'yyyy-MM-dd' 또는 'yyyy-MM-ddTHH:MM:SS...' 형식이면 앞 10글자만 사용
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // 그 외 문자열은 Date 파싱 시도
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, TIMEZONE, 'yyyy-MM-dd');
  }
  return s;
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = (params.action || 'read').toLowerCase();

  // 어떤 탭에 기록할지 결정 (허용 목록 밖이면 기본 탭으로)
  let sheetName = params.sheet || DEFAULT_SHEET;
  if (ALLOWED_SHEETS.indexOf(sheetName) === -1) sheetName = DEFAULT_SHEET;

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['date', 'count']);
    // date 칼럼 전체를 plain text 포맷으로 고정 (자동 Date 변환 방지)
    sheet.getRange('A:A').setNumberFormat('@');
  }

  const today = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const data = sheet.getDataRange().getValues();
    // 동일 일자에 중복 행이 있어도 모두 합산하도록 처리
    const todayRows = []; // 1-based row index
    let todayCount = 0;
    let total = 0;

    for (let i = 1; i < data.length; i++) {
      const dStr = normalizeDateCell(data[i][0]);
      const c = Number(data[i][1]) || 0;
      total += c;
      if (dStr === today) {
        todayRows.push(i + 1);
        todayCount += c;
      }
    }

    if (action === 'count') {
      todayCount += 1;
      total += 1;
      if (todayRows.length === 0) {
        // 새 행 추가 — Date 자동 변환 방지를 위해 plain text 포맷 강제 후 문자열로 setValue
        sheet.appendRow([today, 1]);
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow, 1).setNumberFormat('@').setValue(today);
      } else {
        // 첫 행을 누적값으로 업데이트, 나머지 중복 행은 0으로 비워 합산 유지하지 않음
        const firstRow = todayRows[0];
        sheet.getRange(firstRow, 1).setNumberFormat('@').setValue(today);
        sheet.getRange(firstRow, 2).setValue(todayCount);
        for (let k = 1; k < todayRows.length; k++) {
          sheet.getRange(todayRows[k], 2).setValue(0);
        }
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ today: todayCount, total: total }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
