/**
 * CloudPanel - 클라우드 저장/불러오기 및 로그인 패널
 */

import { supabaseManager } from '../../core/SupabaseManager.js';
import { stateManager } from '../../core/StateManager.js';
import { autoSaveManager } from '../../core/AutoSaveManager.js';
import { eventBus } from '../../utils/EventBus.js';

class CloudPanel {
  constructor() {
    this.modal = null;
  }

  /**
   * 패널 열기
   */
  show() {
    this.render();
  }

  /**
   * 모달 렌더링
   */
  render() {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay cloud-modal active';

    // Supabase 미설정 시: 관리자만 설정 가능하도록 로그인 먼저 요청
    // 단, 최초 설정 시에는 설정 화면 표시
    if (!supabaseManager.isSupabaseConfigured()) {
      this.modal.innerHTML = this.getConfigHTML();
    } else if (!supabaseManager.isLoggedIn()) {
      this.modal.innerHTML = this.getLoginHTML();
    } else if (supabaseManager.isAdmin()) {
      // 관리자: 설정 탭 + 프로젝트 탭
      this.modal.innerHTML = this.getAdminHTML();
    } else {
      // 일반 사용자: 프로젝트만
      this.modal.innerHTML = this.getProjectsHTML();
    }

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  /**
   * Supabase 설정 HTML
   */
  getConfigHTML() {
    return `
      <div class="modal-content cloud-content">
        <div class="modal-header">
          <h3>클라우드 설정</h3>
          <button class="modal-close" id="cloud-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="cloud-info">
            <p>클라우드 저장 기능을 사용하려면 Supabase 설정이 필요합니다.</p>
            <ol>
              <li><a href="https://supabase.com" target="_blank">supabase.com</a>에서 무료 프로젝트 생성</li>
              <li>Project URL과 anon key를 아래에 입력</li>
              <li>SQL Editor에서 테이블 생성 (아래 SQL 참고)</li>
            </ol>
          </div>
          <details class="sql-details">
            <summary>테이블 생성 SQL</summary>
            <pre class="sql-code">CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- RLS 정책
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id);</pre>
          </details>
          <div class="form-group">
            <label for="supabase-url">Project URL</label>
            <input type="text" id="supabase-url" placeholder="https://xxxxx.supabase.co">
          </div>
          <div class="form-group">
            <label for="supabase-key">Anon Key</label>
            <input type="password" id="supabase-key" placeholder="eyJhbGciOiJIUzI1NiIs...">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cloud-cancel">취소</button>
          <button class="btn btn-primary" id="cloud-configure">설정 저장</button>
        </div>
      </div>
    `;
  }

  /**
   * 로그인 HTML
   */
  getLoginHTML() {
    return `
      <div class="modal-content cloud-content">
        <div class="modal-header">
          <h3>클라우드 로그인</h3>
          <button class="modal-close" id="cloud-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="cloud-tabs">
            <button class="cloud-tab active" data-tab="login">로그인</button>
            <button class="cloud-tab" data-tab="signup">회원가입</button>
          </div>
          <div class="cloud-tab-content" id="login-tab">
            <div class="form-group">
              <label for="login-email">이메일</label>
              <input type="email" id="login-email" placeholder="email@example.com">
            </div>
            <div class="form-group">
              <label for="login-password">비밀번호</label>
              <input type="password" id="login-password" placeholder="비밀번호">
            </div>
            <button class="btn btn-primary btn-full" id="login-btn">로그인</button>
          </div>
          <div class="cloud-tab-content" id="signup-tab" style="display:none;">
            <div class="form-group">
              <label for="signup-email">이메일</label>
              <input type="email" id="signup-email" placeholder="email@example.com">
            </div>
            <div class="form-group">
              <label for="signup-password">비밀번호</label>
              <input type="password" id="signup-password" placeholder="비밀번호 (6자 이상)">
            </div>
            <div class="form-group">
              <label for="signup-password-confirm">비밀번호 확인</label>
              <input type="password" id="signup-password-confirm" placeholder="비밀번호 확인">
            </div>
            <button class="btn btn-primary btn-full" id="signup-btn">회원가입</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 프로젝트 목록 HTML
   */
  getProjectsHTML() {
    const user = supabaseManager.getUser();
    return `
      <div class="modal-content cloud-content">
        <div class="modal-header">
          <h3>클라우드 프로젝트</h3>
          <button class="modal-close" id="cloud-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="cloud-user-info">
            <span class="user-email">${user.email}</span>
            <button class="btn btn-sm btn-secondary" id="logout-btn">로그아웃</button>
          </div>
          <div class="cloud-actions">
            <button class="btn btn-primary" id="cloud-save-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              현재 작업 저장
            </button>
          </div>
          <div class="cloud-project-list" id="project-list">
            <div class="loading">프로젝트 목록 로딩 중...</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 관리자용 HTML (설정 + 프로젝트 탭)
   */
  getAdminHTML() {
    const user = supabaseManager.getUser();
    const currentUrl = localStorage.getItem('eGIS_supabaseUrl') || '';
    const currentKey = localStorage.getItem('eGIS_supabaseKey') || '';

    return `
      <div class="modal-content cloud-content">
        <div class="modal-header">
          <h3>클라우드 관리 (관리자)</h3>
          <button class="modal-close" id="cloud-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="cloud-user-info">
            <span class="user-email">${user.email} <span class="admin-badge">관리자</span></span>
            <button class="btn btn-sm btn-secondary" id="logout-btn">로그아웃</button>
          </div>
          <div class="cloud-tabs">
            <button class="cloud-tab active" data-tab="admin-projects">프로젝트</button>
            <button class="cloud-tab" data-tab="admin-settings">Supabase 설정</button>
          </div>
          <div class="cloud-tab-content" id="admin-projects-tab">
            <div class="cloud-actions">
              <button class="btn btn-primary" id="cloud-save-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                현재 작업 저장
              </button>
            </div>
            <div class="cloud-project-list" id="project-list">
              <div class="loading">프로젝트 목록 로딩 중...</div>
            </div>
          </div>
          <div class="cloud-tab-content" id="admin-settings-tab" style="display:none;">
            <div class="cloud-info">
              <p>Supabase 연결 설정을 변경할 수 있습니다.</p>
            </div>
            <div class="form-group">
              <label for="supabase-url">Project URL</label>
              <input type="text" id="supabase-url" placeholder="https://xxxxx.supabase.co" value="${currentUrl}">
            </div>
            <div class="form-group">
              <label for="supabase-key">Anon Key</label>
              <input type="password" id="supabase-key" placeholder="eyJhbGciOiJIUzI1NiIs..." value="${currentKey}">
            </div>
            <button class="btn btn-primary" id="cloud-configure">설정 저장</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 닫기 버튼
    const closeBtn = document.getElementById('cloud-close');
    const cancelBtn = document.getElementById('cloud-cancel');

    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

    // Supabase 설정
    const configBtn = document.getElementById('cloud-configure');
    if (configBtn) {
      configBtn.addEventListener('click', () => this.saveConfig());
    }

    // 탭 전환
    const tabs = this.modal.querySelectorAll('.cloud-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // 로그인
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    // 회원가입
    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
      signupBtn.addEventListener('click', () => this.handleSignup());
    }

    // Google 로그인
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
    }

    // 설정 초기화
    const resetConfigBtn = document.getElementById('reset-config-btn');
    if (resetConfigBtn) {
      resetConfigBtn.addEventListener('click', () => this.resetConfig());
    }

    // 로그아웃
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // 프로젝트 저장
    const saveBtn = document.getElementById('cloud-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveToCloud());
    }

    // 프로젝트 목록 로드
    if (supabaseManager.isLoggedIn()) {
      this.loadProjectList();
    }
  }

  /**
   * 탭 전환
   */
  switchTab(tabName) {
    this.modal.querySelectorAll('.cloud-tab').forEach(t => t.classList.remove('active'));
    this.modal.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    this.modal.querySelectorAll('.cloud-tab-content').forEach(c => c.style.display = 'none');
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
      tabContent.style.display = 'block';
    }
  }

  /**
   * Supabase 설정 저장
   */
  saveConfig() {
    const url = document.getElementById('supabase-url').value.trim();
    const key = document.getElementById('supabase-key').value.trim();

    if (!url || !key) {
      alert('URL과 Key를 모두 입력해주세요.');
      return;
    }

    supabaseManager.configure(url, key);
  }

  /**
   * 설정 초기화
   */
  resetConfig() {
    if (confirm('Supabase 설정을 초기화하시겠습니까?')) {
      localStorage.removeItem('eGIS_supabaseUrl');
      localStorage.removeItem('eGIS_supabaseKey');
      window.location.reload();
    }
  }

  /**
   * 로그인 처리
   */
  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    try {
      await supabaseManager.signIn(email, password);
      alert('로그인 성공!');
      this.render(); // 프로젝트 목록으로 전환
    } catch (error) {
      alert('로그인 실패: ' + error.message);
    }
  }

  /**
   * Google 로그인 처리
   */
  async handleGoogleLogin() {
    try {
      await supabaseManager.signInWithGoogle();
      // OAuth는 리다이렉트 방식이므로 페이지가 새로고침됨
    } catch (error) {
      alert('Google 로그인 실패: ' + error.message);
    }
  }

  /**
   * 회원가입 처리
   */
  async handleSignup() {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;

    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (password.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (password !== passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      await supabaseManager.signUp(email, password);
      alert('회원가입 완료! 로그인해주세요.');
    } catch (error) {
      alert('회원가입 실패: ' + error.message);
    }
  }

  /**
   * 로그아웃 처리
   */
  async handleLogout() {
    try {
      await supabaseManager.signOut();
      this.render(); // 로그인 화면으로 전환
    } catch (error) {
      alert('로그아웃 실패: ' + error.message);
    }
  }

  /**
   * 프로젝트 목록 로드
   */
  async loadProjectList() {
    const listEl = document.getElementById('project-list');
    if (!listEl) return;

    try {
      const projects = await supabaseManager.listProjects();

      if (projects.length === 0) {
        listEl.innerHTML = '<div class="empty-list">저장된 프로젝트가 없습니다.</div>';
        return;
      }

      listEl.innerHTML = projects.map(p => `
        <div class="project-item" data-id="${p.id}">
          <div class="project-info">
            <span class="project-name">${p.name}</span>
            <span class="project-date">${new Date(p.updated_at).toLocaleString()}</span>
          </div>
          <div class="project-actions">
            <button class="btn btn-sm btn-primary load-project-btn" data-id="${p.id}">불러오기</button>
            <button class="btn btn-sm btn-danger delete-project-btn" data-id="${p.id}">삭제</button>
          </div>
        </div>
      `).join('');

      // 프로젝트 불러오기 버튼
      listEl.querySelectorAll('.load-project-btn').forEach(btn => {
        btn.addEventListener('click', () => this.loadFromCloud(btn.dataset.id));
      });

      // 프로젝트 삭제 버튼
      listEl.querySelectorAll('.delete-project-btn').forEach(btn => {
        btn.addEventListener('click', () => this.deleteFromCloud(btn.dataset.id));
      });

    } catch (error) {
      listEl.innerHTML = `<div class="error">프로젝트 목록 로드 실패: ${error.message}</div>`;
    }
  }

  /**
   * 클라우드에 저장
   */
  async saveToCloud() {
    const projectName = prompt('프로젝트 이름을 입력하세요:', '내 프로젝트');
    if (!projectName) return;

    try {
      // 현재 모든 레이어 저장
      await autoSaveManager.saveAllLayers();

      // 클라우드에 동기화
      await supabaseManager.syncToCloud(projectName);
      alert('클라우드에 저장되었습니다!');
      this.loadProjectList();
    } catch (error) {
      alert('저장 실패: ' + error.message);
    }
  }

  /**
   * 클라우드에서 불러오기
   */
  async loadFromCloud(projectId) {
    if (!confirm('현재 작업을 클라우드 프로젝트로 대체하시겠습니까?')) return;

    try {
      await supabaseManager.syncFromCloud(projectId);
      alert('프로젝트를 불러왔습니다. 페이지를 새로고침합니다.');
      window.location.reload();
    } catch (error) {
      alert('불러오기 실패: ' + error.message);
    }
  }

  /**
   * 클라우드에서 삭제
   */
  async deleteFromCloud(projectId) {
    if (!confirm('이 프로젝트를 삭제하시겠습니까?')) return;

    try {
      await supabaseManager.deleteProject(projectId);
      this.loadProjectList();
    } catch (error) {
      alert('삭제 실패: ' + error.message);
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

export const cloudPanel = new CloudPanel();
