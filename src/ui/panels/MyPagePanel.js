/**
 * MyPagePanel - 마이페이지 패널
 * 프로필 관리, 비밀번호 변경, 학교 통계
 */

import { supabaseManager } from '../../core/SupabaseManager.js';

// 시도 목록 (짧은 이름)
const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
];

class MyPagePanel {
  constructor() {
    this.modal = null;
    this.profile = null;
  }

  /**
   * 패널 열기
   */
  async show() {
    if (!supabaseManager.isLoggedIn()) {
      alert('로그인이 필요합니다.');
      return;
    }
    await this.render();
  }

  /**
   * 모달 렌더링
   */
  async render() {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay mypage-modal active';

    // 프로필 로드
    try {
      this.profile = await supabaseManager.getProfile();
    } catch (error) {
      console.error('프로필 로드 실패:', error);
      this.profile = null;
    }

    const user = supabaseManager.getUser();

    this.modal.innerHTML = `
      <div class="modal-content mypage-content">
        <div class="modal-header">
          <h3>마이페이지</h3>
          <button class="modal-close" id="mypage-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="mypage-tabs">
            <button class="mypage-tab active" data-tab="profile">프로필</button>
            <button class="mypage-tab" data-tab="password">비밀번호 변경</button>
            <button class="mypage-tab" data-tab="school-stats">학교 통계</button>
            ${supabaseManager.isAdmin() ? '<button class="mypage-tab" data-tab="admin">관리자 설정</button>' : ''}
          </div>

          <!-- 프로필 탭 -->
          <div class="mypage-tab-content active" id="profile-tab">
            <div class="profile-email">
              <label>이메일</label>
              <span>${user.email}</span>
            </div>
            <div class="form-group">
              <label for="profile-name">이름</label>
              <input type="text" id="profile-name" placeholder="이름을 입력하세요" value="${this.profile?.name || ''}">
            </div>
            <div class="form-group">
              <label for="profile-nickname">닉네임</label>
              <input type="text" id="profile-nickname" placeholder="닉네임을 입력하세요" value="${this.profile?.nickname || ''}">
            </div>

            <div class="school-registration-section">
              <h4>학교 등록</h4>
              ${this.profile?.school ? `
                <div class="current-school">
                  <span class="school-badge">${this.profile.region || ''} ${this.profile.school}</span>
                </div>
              ` : ''}
              <div class="form-group">
                <label for="profile-region">지역 (시/도)</label>
                <select id="profile-region">
                  <option value="">지역을 선택하세요</option>
                  ${REGIONS.map(r => `<option value="${r}" ${this.profile?.region === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="profile-school">학교명</label>
                <input type="text" id="profile-school" placeholder="공식 학교 명칭을 적어주세요" value="${this.profile?.school || ''}">
              </div>
            </div>

            <button class="btn btn-primary btn-full" id="save-profile-btn">프로필 저장</button>
          </div>

          <!-- 비밀번호 변경 탭 -->
          <div class="mypage-tab-content" id="password-tab" style="display:none;">
            <div class="form-group">
              <label for="new-password">새 비밀번호</label>
              <input type="password" id="new-password" placeholder="새 비밀번호 (6자 이상)">
            </div>
            <div class="form-group">
              <label for="confirm-password">비밀번호 확인</label>
              <input type="password" id="confirm-password" placeholder="비밀번호 확인">
            </div>
            <button class="btn btn-primary btn-full" id="change-password-btn">비밀번호 변경</button>
          </div>

          <!-- 학교 통계 탭 -->
          <div class="mypage-tab-content" id="school-stats-tab" style="display:none;">
            <div id="my-school-info" class="my-school-info">
              <div class="loading">학교 정보 로딩 중...</div>
            </div>
            <h4>학교별 사용자 순위</h4>
            <div id="school-ranking" class="school-ranking">
              <div class="loading">순위 로딩 중...</div>
            </div>
          </div>

          ${supabaseManager.isAdmin() ? `
          <!-- 관리자 설정 탭 -->
          <div class="mypage-tab-content" id="admin-tab" style="display:none;">
            <div class="admin-section">
              <h4>Supabase 설정</h4>
              <p class="admin-warning">주의: 설정을 초기화하면 다시 URL과 Key를 입력해야 합니다.</p>
              <button class="btn btn-danger" id="reset-supabase-btn">Supabase 설정 초기화</button>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 닫기 버튼
    const closeBtn = document.getElementById('mypage-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // 탭 전환
    const tabs = this.modal.querySelectorAll('.mypage-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // 프로필 저장
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', () => this.saveProfile());
    }

    // 비밀번호 변경
    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => this.changePassword());
    }

    // Supabase 초기화 (관리자 전용)
    const resetSupabaseBtn = document.getElementById('reset-supabase-btn');
    if (resetSupabaseBtn) {
      resetSupabaseBtn.addEventListener('click', () => this.resetSupabase());
    }
  }

  /**
   * Supabase 설정 초기화 (관리자 전용)
   */
  resetSupabase() {
    if (confirm('정말로 Supabase 설정을 초기화하시겠습니까?\n초기화 후 다시 URL과 Key를 입력해야 합니다.')) {
      localStorage.removeItem('eGIS_supabaseUrl');
      localStorage.removeItem('eGIS_supabaseKey');
      alert('Supabase 설정이 초기화되었습니다. 페이지를 새로고침합니다.');
      window.location.reload();
    }
  }

  /**
   * 탭 전환
   */
  switchTab(tabName) {
    this.modal.querySelectorAll('.mypage-tab').forEach(t => t.classList.remove('active'));
    this.modal.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    this.modal.querySelectorAll('.mypage-tab-content').forEach(c => {
      c.style.display = 'none';
      c.classList.remove('active');
    });

    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
      tabContent.style.display = 'block';
      tabContent.classList.add('active');
    }

    // 학교 통계 탭 선택 시 데이터 로드
    if (tabName === 'school-stats') {
      this.loadSchoolStats();
    }
  }

  /**
   * 프로필 저장
   */
  async saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    const nickname = document.getElementById('profile-nickname').value.trim();
    const region = document.getElementById('profile-region').value;
    const school = document.getElementById('profile-school').value.trim();

    if (school && !region) {
      alert('학교를 등록하려면 지역을 선택해주세요.');
      return;
    }

    try {
      await supabaseManager.saveProfile({ name, nickname, region, school });
      alert('프로필이 저장되었습니다.');
      this.profile = { name, nickname, region, school };
      this.render(); // 화면 갱신
    } catch (error) {
      alert('프로필 저장 실패: ' + error.message);
    }
  }

  /**
   * 비밀번호 변경
   */
  async changePassword() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!newPassword || newPassword.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      await supabaseManager.updatePassword(newPassword);
      alert('비밀번호가 변경되었습니다.');
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
    } catch (error) {
      alert('비밀번호 변경 실패: ' + error.message);
    }
  }

  /**
   * 학교 통계 로드
   */
  async loadSchoolStats() {
    const mySchoolInfo = document.getElementById('my-school-info');
    const schoolRanking = document.getElementById('school-ranking');

    try {
      // 내 학교 정보
      const mySchool = await supabaseManager.getMySchoolCount();
      if (mySchool) {
        mySchoolInfo.innerHTML = `
          <div class="my-school-card">
            <div class="my-school-name">${mySchool.school}</div>
            <div class="my-school-stats">
              <div class="stat-item">
                <span class="stat-value">${mySchool.count}</span>
                <span class="stat-label">명 사용 중</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">${mySchool.rank}</span>
                <span class="stat-label">위 / ${mySchool.totalSchools}개 학교</span>
              </div>
            </div>
          </div>
        `;
      } else {
        mySchoolInfo.innerHTML = `
          <div class="no-school-info">
            학교를 등록하면 통계를 확인할 수 있습니다.
          </div>
        `;
      }

      // 학교 순위
      const stats = await supabaseManager.getSchoolStats();
      if (stats.length === 0) {
        schoolRanking.innerHTML = '<div class="empty-list">등록된 학교가 없습니다.</div>';
        return;
      }

      schoolRanking.innerHTML = `
        <div class="ranking-list">
          ${stats.slice(0, 10).map((item, index) => `
            <div class="ranking-item ${mySchool && item.school === mySchool.school ? 'my-school' : ''}">
              <span class="ranking-position">${index + 1}</span>
              <span class="ranking-school">${item.school}</span>
              <span class="ranking-count">${item.count}명</span>
            </div>
          `).join('')}
        </div>
        ${stats.length > 10 ? `<div class="ranking-more">외 ${stats.length - 10}개 학교</div>` : ''}
      `;

    } catch (error) {
      console.error('학교 통계 로드 실패:', error);
      mySchoolInfo.innerHTML = '<div class="error">정보를 불러올 수 없습니다.</div>';
      schoolRanking.innerHTML = '<div class="error">순위를 불러올 수 없습니다.</div>';
    }
  }

  /**
   * 모달 닫기
   */
  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const myPagePanel = new MyPagePanel();
