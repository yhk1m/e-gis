// © 2026 김용현
/**
 * VisitorTracker - 조회수 카운터 (Apps Script Web App + 디바이스당 일 1회)
 *
 * GeoSource와 동일 방식:
 *  - 구글 시트(viewership: [date, count])에 하루 1행으로 누적 (scripts/viewership.gs)
 *  - today = 오늘 카운트, total = 전체 합
 *  - 같은 디바이스는 하루 1회만 카운트(localStorage). 이후 같은 날엔 조회만(read).
 */

// Apps Script 웹앱 URL — scripts/viewership.gs 배포 후 받은 /exec URL.
// 비어 있으면 카운터는 조용히 동작하지 않습니다(에러 없음).
const VIEWERSHIP_URL = 'https://script.google.com/macros/s/AKfycbzoiENiKQTcvEVedXSUKa3z8w5NPLGYQr5hd8_lmWSmWndqsGaMAwp3a-OfgXZZLrXB/exec';
const VIEWERSHIP_SHEET = 'egis'; // 통합 스크립트에서 eGIS 전용 탭 지정
const VIEWERSHIP_LS_KEY = 'egis_last_visit';

class VisitorTracker {
  /** KST(UTC+9) 기준 YYYY-MM-DD */
  kstDateString() {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return now.toISOString().slice(0, 10);
  }

  /**
   * 조회수 기록 및 표시
   *  - 오늘 처음 방문한 디바이스: action=count (오늘 카운트 +1)
   *  - 오늘 이미 방문한 디바이스: action=read (증가 없이 조회만)
   */
  async init() {
    if (!VIEWERSHIP_URL) return; // URL 미설정 시 조용히 스킵

    try {
      const today = this.kstDateString();
      const last = localStorage.getItem(VIEWERSHIP_LS_KEY);
      const action = last === today ? 'read' : 'count';

      const res = await fetch(`${VIEWERSHIP_URL}?action=${action}&sheet=${VIEWERSHIP_SHEET}`, { method: 'GET' });
      if (!res.ok) return;

      const data = await res.json();
      this.updateUI(Number(data.today || 0), Number(data.total || 0));

      if (action === 'count') localStorage.setItem(VIEWERSHIP_LS_KEY, today);
    } catch (e) {
      // 네트워크 오류 시 표시는 기존값('-') 유지
    }
  }

  /** 상태바 카운터 UI 업데이트 */
  updateUI(today, total) {
    const todayEl = document.getElementById('visitor-today');
    const totalEl = document.getElementById('visitor-total');
    if (todayEl) todayEl.textContent = today.toLocaleString('ko-KR');
    if (totalEl) totalEl.textContent = total.toLocaleString('ko-KR');
  }
}

export const visitorTracker = new VisitorTracker();
