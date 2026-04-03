/**
 * ConsentManager - 개인정보 동의 관리
 * 동의 기록, 조회, 철회 처리
 */

import { supabaseManager } from './SupabaseManager.js';
import { PRIVACY_POLICY_VERSION } from '../ui/panels/PrivacyPolicyPanel.js';

class ConsentManager {
  constructor() {
    this.consentKey = 'eGIS_privacyConsent';
  }

  /**
   * 동의 정보 생성
   */
  createConsentData() {
    return {
      privacy_consent: true,
      privacy_consent_at: new Date().toISOString(),
      privacy_policy_version: PRIVACY_POLICY_VERSION
    };
  }

  /**
   * 로컬 동의 정보 저장 (비로그인 상태용)
   */
  saveLocalConsent() {
    const consentData = this.createConsentData();
    localStorage.setItem(this.consentKey, JSON.stringify(consentData));
    return consentData;
  }

  /**
   * 로컬 동의 정보 조회
   */
  getLocalConsent() {
    const data = localStorage.getItem(this.consentKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * 로컬 동의 정보 삭제
   */
  clearLocalConsent() {
    localStorage.removeItem(this.consentKey);
  }

  /**
   * 사용자 동의 정보 저장 (Supabase user_metadata)
   */
  async saveUserConsent() {
    if (!supabaseManager.isLoggedIn()) {
      throw new Error('로그인이 필요합니다.');
    }

    const consentData = this.createConsentData();

    try {
      await supabaseManager.updateUserMetadata(consentData);
      return consentData;
    } catch (error) {
      console.error('동의 정보 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 동의 정보 조회
   */
  async getUserConsent() {
    if (!supabaseManager.isLoggedIn()) {
      return null;
    }

    try {
      const user = supabaseManager.getUser();
      const metadata = user?.user_metadata || {};

      if (metadata.privacy_consent) {
        return {
          privacy_consent: metadata.privacy_consent,
          privacy_consent_at: metadata.privacy_consent_at,
          privacy_policy_version: metadata.privacy_policy_version
        };
      }

      return null;
    } catch (error) {
      console.error('동의 정보 조회 실패:', error);
      return null;
    }
  }

  /**
   * 동의 일시 포맷팅
   */
  formatConsentDate(isoString) {
    if (!isoString) return '-';

    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 동의 버전 확인 (최신 버전인지)
   */
  isLatestVersion(userVersion) {
    return userVersion === PRIVACY_POLICY_VERSION;
  }

  /**
   * 회원 탈퇴 (동의 철회)
   */
  async withdrawConsent() {
    if (!supabaseManager.isLoggedIn()) {
      throw new Error('로그인이 필요합니다.');
    }

    try {
      // 1. 사용자 프로필 삭제
      await supabaseManager.deleteProfile();

      // 2. 사용자 프로젝트 삭제
      await supabaseManager.deleteAllProjects();

      // 3. 계정 삭제 요청 (Supabase에서는 직접 삭제 불가, 관리자 처리 필요)
      // 대신 로그아웃 처리
      await supabaseManager.signOut();

      // 4. 로컬 데이터 정리
      this.clearLocalConsent();

      return true;
    } catch (error) {
      console.error('회원 탈퇴 실패:', error);
      throw error;
    }
  }
}

export const consentManager = new ConsentManager();
