// © 2026 김용현
/**
 * 개인정보 처리방침 페이지 본문 마크업
 *
 * 브라우저(privacy-page.js)와 빌드 후처리(scripts/prerender-privacy.js)가 같은
 * 마크업을 써야 한다. 방침을 JS 로만 그리면 밖에서 페이지를 열어 보는 쪽 —
 * 도름스 마크 재검증, 검색엔진, JS 를 끈 브라우저 — 에는 빈 화면이라 방침 글자를
 * 읽지 못한다. 그래서 빌드 때 이 함수로 dist/privacy.html 에 본문을 미리 심고,
 * 브라우저에서는 같은 결과로 다시 그린다.
 *
 * baseUrl 은 PDF 링크 경로에만 쓰인다. 브라우저는 import.meta.env.BASE_URL 을,
 * 빌드 스크립트는 '/' 를 넘긴다.
 */
import { PRIVACY_POLICY_CONTENT, PRIVACY_POLICY_VERSION } from './panels/PrivacyPolicyPanel.js';

export function privacyPageHTML(baseUrl = '/') {
  return `
    <div class="privacy-page">
      <header class="privacy-page-header">
        <a href="/" class="privacy-page-logo">e-GIS</a>
        <span class="privacy-page-title">개인정보 처리방침</span>
      </header>
      <main class="privacy-page-main">
        <h1 class="privacy-page-heading">${PRIVACY_POLICY_CONTENT.title}</h1>
        <div class="privacy-page-meta">
          <span>버전: ${PRIVACY_POLICY_VERSION}</span>
          <span>시행일: ${PRIVACY_POLICY_CONTENT.effectiveDate}</span>
          <span>최종 수정: ${PRIVACY_POLICY_CONTENT.lastUpdated}</span>
        </div>
        <div class="privacy-page-intro">${PRIVACY_POLICY_CONTENT.intro}</div>
        <div class="privacy-page-sections">
          ${PRIVACY_POLICY_CONTENT.sections.map(section => `
            <section class="privacy-page-section">
              <h2>${section.title}</h2>
              <div class="privacy-page-section-content">${section.content.replace(/\n/g, '<br>')}</div>
            </section>
          `).join('')}
        </div>
        <div class="privacy-page-actions">
          <a href="${baseUrl}privacy-policy.pdf" download="개인정보 처리방침(e-GIS).pdf" class="privacy-page-btn privacy-page-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            PDF 다운로드
          </a>
          <a href="javascript:void(0)" class="privacy-page-btn" onclick="window.close(); setTimeout(() => history.back(), 100);">창 닫기</a>
        </div>
      </main>
      <footer class="privacy-page-footer">
        <p>e-GIS - 교육용 GIS 웹 애플리케이션</p>
        <p>개인정보 보호책임자: 김용현 (bgnlkim@gmail.com)</p>
      </footer>
    </div>
  `;
}
