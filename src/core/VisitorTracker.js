/**
 * VisitorTracker - 방문자 카운터
 * 오늘/총 방문자 수를 Supabase로 추적
 */

import { supabaseManager } from './SupabaseManager.js';

class VisitorTracker {
  constructor() {
    this.counts = { today: 0, total: 0 };
  }

  /**
   * 방문자 ID 생성 또는 가져오기 (브라우저별 고유)
   */
  getVisitorId() {
    const key = 'egis_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(key, id);
    }
    return id;
  }

  /**
   * 오늘 이미 기록했는지 확인
   */
  isRecordedToday() {
    const key = 'egis_visit_date';
    const today = new Date().toISOString().slice(0, 10);
    return localStorage.getItem(key) === today;
  }

  /**
   * 오늘 기록 완료 표시
   */
  markRecordedToday() {
    const key = 'egis_visit_date';
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(key, today);
  }

  /**
   * 방문 기록 및 카운트 조회
   */
  async init() {
    // Supabase 초기화 대기
    await this.waitForSupabase();

    const supabase = supabaseManager.supabase;
    if (!supabase) return;

    // 오늘 아직 기록 안 했으면 기록
    if (!this.isRecordedToday()) {
      try {
        const visitorId = this.getVisitorId();
        await supabase.from('page_views').insert({
          visitor_id: visitorId
        });
        this.markRecordedToday();
      } catch (e) {
        console.warn('방문 기록 실패:', e);
      }
    }

    // 카운트 조회
    await this.fetchCounts();
    this.updateUI();
  }

  /**
   * Supabase 초기화 대기
   */
  waitForSupabase() {
    return new Promise((resolve) => {
      if (supabaseManager.supabase) {
        resolve();
        return;
      }
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (supabaseManager.supabase || attempts > 30) {
          clearInterval(interval);
          resolve();
        }
      }, 200);
    });
  }

  /**
   * 방문자 수 조회
   */
  async fetchCounts() {
    const supabase = supabaseManager.supabase;
    if (!supabase) return;

    try {
      // RPC 함수 사용 시도
      const { data, error } = await supabase.rpc('get_visitor_counts');
      if (!error && data) {
        this.counts = data;
        return;
      }

      // RPC 실패 시 직접 쿼리
      const today = new Date().toISOString().slice(0, 10);

      const [todayResult, totalResult] = await Promise.all([
        supabase.from('page_views').select('visitor_id').eq('visit_date', today),
        supabase.from('page_views').select('visitor_id')
      ]);

      if (todayResult.data) {
        const todayUnique = new Set(todayResult.data.map(r => r.visitor_id));
        this.counts.today = todayUnique.size;
      }

      if (totalResult.data) {
        const totalUnique = new Set(totalResult.data.map(r => r.visitor_id));
        this.counts.total = totalUnique.size;
      }
    } catch (e) {
      console.warn('방문자 수 조회 실패:', e);
    }
  }

  /**
   * UI 업데이트
   */
  updateUI() {
    const todayEl = document.getElementById('visitor-today');
    const totalEl = document.getElementById('visitor-total');

    if (todayEl) todayEl.textContent = this.counts.today.toLocaleString('ko-KR');
    if (totalEl) totalEl.textContent = this.counts.total.toLocaleString('ko-KR');
  }
}

export const visitorTracker = new VisitorTracker();
