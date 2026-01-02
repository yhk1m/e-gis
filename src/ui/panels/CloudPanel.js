/**
 * CloudPanel - 로그인/회원가입 패널
 * (클라우드 저장 기능 제거됨)
 */

import { supabaseManager } from '../../core/SupabaseManager.js';
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

    // Supabase 미설정 시: 설정 화면 표시
    if (!supabaseManager.isSupabaseConfigured()) {
      this.modal.innerHTML = this.getConfigHTML();
    } else if (!supabaseManager.isLoggedIn()) {
      this.modal.innerHTML = this.getLoginHTML();
    } else {
      // 이미 로그인 되어있으면 모달 닫기
      this.close();
      return;
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
          <h3>로그인 설정</h3>
          <button class="modal-close" id="cloud-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="cloud-info">
            <p>로그인 기능을 사용하려면 Supabase 설정이 필요합니다.</p>
            <ol>
              <li><a href="https://supabase.com" target="_blank">supabase.com</a>에서 무료 프로젝트 생성</li>
              <li>Project URL과 anon key를 아래에 입력</li>
            </ol>
          </div>
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
          <h3>로그인</h3>
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

    // Enter 키로 로그인/회원가입
    const loginPassword = document.getElementById('login-password');
    if (loginPassword) {
      loginPassword.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleLogin();
      });
    }

    const signupPasswordConfirm = document.getElementById('signup-password-confirm');
    if (signupPasswordConfirm) {
      signupPasswordConfirm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSignup();
      });
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
    this.render(); // 로그인 화면으로 전환
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
      eventBus.emit('auth:login');
      this.close();
    } catch (error) {
      alert('로그인 실패: ' + error.message);
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
      this.switchTab('login');
    } catch (error) {
      alert('회원가입 실패: ' + error.message);
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
