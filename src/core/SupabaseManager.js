/**
 * SupabaseManager - Supabase 클라우드 연동 관리
 * 사용자 인증 및 프로젝트 클라우드 저장/불러오기
 */

import { eventBus } from '../utils/EventBus.js';
import { stateManager } from './StateManager.js';

// Supabase 설정 (하드코딩)
const SUPABASE_URL = 'https://lufbotdmhgsuvejlytgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZmJvdGRtaGdzdXZlamx5dGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMDY1NzUsImV4cCI6MjA4MTg4MjU3NX0.JMzU8SiR8jb39xcRe4ySQSvZJButJP8OeCqOMDkNbRI';

// 관리자 이메일
const ADMIN_EMAIL = 'fkv777@gmail.com';

class SupabaseManager {
  constructor() {
    this.supabase = null;
    this.user = null;
    this.isConfigured = false;
  }

  /**
   * Supabase 클라이언트 초기화
   */
  async init() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Supabase 설정이 없습니다. 클라우드 기능이 비활성화됩니다.');
      return false;
    }

    try {
      // Supabase JS 라이브러리 동적 로드
      if (!window.supabase) {
        await this.loadSupabaseScript();
      }

      this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      this.isConfigured = true;

      // 현재 세션 확인
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.user = session.user;
        eventBus.emit('auth:login', { user: this.user });
      }

      // 인증 상태 변경 리스너
      this.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
          this.user = session.user;
          eventBus.emit('auth:login', { user: this.user });
        } else if (event === 'SIGNED_OUT') {
          this.user = null;
          eventBus.emit('auth:logout', {});
        }
      });

      console.log('Supabase 초기화 완료');
      return true;
    } catch (error) {
      console.error('Supabase 초기화 실패:', error);
      return false;
    }
  }

  /**
   * Supabase JS 스크립트 동적 로드
   */
  loadSupabaseScript() {
    return new Promise((resolve, reject) => {
      if (window.supabase) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Supabase 설정 저장
   */
  configure(url, anonKey) {
    localStorage.setItem('eGIS_supabaseUrl', url);
    localStorage.setItem('eGIS_supabaseKey', anonKey);
    window.location.reload(); // 설정 적용을 위해 새로고침
  }

  /**
   * 설정 여부 확인
   */
  isSupabaseConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  /**
   * 로그인 상태 확인
   */
  isLoggedIn() {
    return !!this.user;
  }

  /**
   * 현재 사용자 정보
   */
  getUser() {
    return this.user;
  }

  /**
   * 관리자 여부 확인
   */
  isAdmin() {
    return this.user && this.user.email === ADMIN_EMAIL;
  }

  // ==================== 인증 ====================

  /**
   * 이메일/비밀번호로 회원가입
   */
  async signUp(email, password) {
    if (!this.supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;
    return data;
  }

  /**
   * 이메일/비밀번호로 로그인
   */
  async signIn(email, password) {
    if (!this.supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    this.user = data.user;
    return data;
  }

  /**
   * Google OAuth 로그인
   */
  async signInWithGoogle() {
    if (!this.supabase) throw new Error('Supabase가 설정되지 않았습니다.');

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    return data;
  }

  /**
   * 로그아웃
   */
  async signOut() {
    if (!this.supabase) return;

    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    this.user = null;
  }

  /**
   * 비밀번호 변경
   */
  async updatePassword(newPassword) {
    if (!this.supabase || !this.user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { error } = await this.supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    return true;
  }

  // ==================== 프로필 관리 ====================

  /**
   * 사용자 프로필 가져오기
   */
  async getProfile() {
    if (!this.supabase || !this.user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', this.user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116: no rows found
    return data;
  }

  /**
   * 프로필 저장/업데이트
   */
  async saveProfile(profileData) {
    if (!this.supabase || !this.user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { data, error } = await this.supabase
      .from('user_profiles')
      .upsert({
        user_id: this.user.id,
        name: profileData.name,
        nickname: profileData.nickname,
        school: profileData.school,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * 학교별 사용자 통계 가져오기
   */
  async getSchoolStats() {
    if (!this.supabase || !this.user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('school')
      .not('school', 'is', null)
      .not('school', 'eq', '');

    if (error) throw error;

    // 학교별 집계
    const stats = {};
    data.forEach(row => {
      if (row.school) {
        stats[row.school] = (stats[row.school] || 0) + 1;
      }
    });

    // 순위 정렬
    const ranked = Object.entries(stats)
      .map(([school, count]) => ({ school, count }))
      .sort((a, b) => b.count - a.count);

    return ranked;
  }

  /**
   * 내 학교 사용자 수 가져오기
   */
  async getMySchoolCount() {
    const profile = await this.getProfile();
    if (!profile || !profile.school) return null;

    const stats = await this.getSchoolStats();
    const mySchool = stats.find(s => s.school === profile.school);
    const rank = stats.findIndex(s => s.school === profile.school) + 1;

    return {
      school: profile.school,
      count: mySchool ? mySchool.count : 0,
      rank: rank || null,
      totalSchools: stats.length
    };
  }

  // ==================== 프로젝트 저장/불러오기 ====================

  /**
   * 프로젝트를 클라우드에 저장
   */
  async saveProject(projectName, projectData) {
    if (!this.supabase || !this.user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { data, error } = await this.supabase
      .from('projects')
      .upsert({
        user_id: this.user.id,
        name: projectName,
        data: projectData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,name'
      })
      .select();

    if (error) throw error;
    return data;
  }

  /**
   * 사용자의 프로젝트 목록 가져오기
   */
  async listProjects() {
    if (!this.supabase || !this.user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { data, error } = await this.supabase
      .from('projects')
      .select('id, name, updated_at')
      .eq('user_id', this.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * 프로젝트 불러오기
   */
  async loadProject(projectId) {
    if (!this.supabase || !this.user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', this.user.id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 프로젝트 삭제
   */
  async deleteProject(projectId) {
    if (!this.supabase || !this.user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { error } = await this.supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', this.user.id);

    if (error) throw error;
    return true;
  }

  /**
   * 현재 상태를 클라우드에 동기화
   */
  async syncToCloud(projectName = '자동 저장') {
    const projectData = await stateManager.exportProject();
    return await this.saveProject(projectName, projectData);
  }

  /**
   * 클라우드에서 상태 복원
   */
  async syncFromCloud(projectId) {
    const project = await this.loadProject(projectId);
    if (project && project.data) {
      await stateManager.importProject(project.data);
      return true;
    }
    return false;
  }
}

export const supabaseManager = new SupabaseManager();
