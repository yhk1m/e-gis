/**
 * ThemeManager - 다크/라이트 테마 전환 관리
 */

const THEME_KEY = 'egis-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
    this.listeners = [];
  }

  /**
   * 저장된 테마 가져오기
   */
  getStoredTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  /**
   * 시스템 테마 감지
   */
  getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEMES.DARK;
    }
    return THEMES.LIGHT;
  }

  /**
   * 현재 테마 가져오기
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * 테마 적용
   */
  applyTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    this.notifyListeners(theme);
  }

  /**
   * 테마 전환
   */
  toggle() {
    const newTheme = this.currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    this.applyTheme(newTheme);
    return newTheme;
  }

  /**
   * 라이트 모드인지 확인
   */
  isLight() {
    return this.currentTheme === THEMES.LIGHT;
  }

  /**
   * 다크 모드인지 확인
   */
  isDark() {
    return this.currentTheme === THEMES.DARK;
  }

  /**
   * 테마 변경 리스너 등록
   */
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * 리스너들에게 테마 변경 알림
   */
  notifyListeners(theme) {
    this.listeners.forEach(callback => callback(theme));
  }

  /**
   * 초기화 - 저장된 테마 또는 시스템 테마 적용
   */
  init() {
    this.applyTheme(this.currentTheme);

    // 시스템 테마 변경 감지
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // 사용자가 수동으로 테마를 설정하지 않았다면 시스템 테마 따라가기
        if (!this.getStoredTheme()) {
          this.applyTheme(e.matches ? THEMES.DARK : THEMES.LIGHT);
        }
      });
    }
  }
}

// 싱글톤 인스턴스
export const themeManager = new ThemeManager();
export { THEMES };
