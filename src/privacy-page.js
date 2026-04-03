/**
 * 개인정보 처리방침 전용 페이지
 */
import { PRIVACY_POLICY_CONTENT, PRIVACY_POLICY_VERSION } from './ui/panels/PrivacyPolicyPanel.js';

// 테마 감지 및 적용
function initTheme() {
  const saved = localStorage.getItem('egis-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function render() {
  initTheme();

  const app = document.getElementById('privacy-app');
  app.innerHTML = `
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
          <a href="${import.meta.env.BASE_URL}privacy-policy.pdf" download="개인정보 처리방침(e-GIS).pdf" class="privacy-page-btn privacy-page-btn-primary">
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

// 스타일 삽입
const style = document.createElement('style');
style.textContent = `
  :root {
    --pp-bg: #ffffff;
    --pp-text: #1a1a2e;
    --pp-text-secondary: #555;
    --pp-border: #e0e0e0;
    --pp-primary: #0066cc;
    --pp-primary-hover: #0052a3;
    --pp-section-bg: #f8f9fa;
    --pp-header-bg: #ffffff;
    --pp-footer-bg: #f1f3f5;
    --pp-meta-bg: #eef2ff;
    --pp-meta-border: #c7d2fe;
  }

  [data-theme="dark"] {
    --pp-bg: #1a1a2e;
    --pp-text: #e0e0e0;
    --pp-text-secondary: #aaa;
    --pp-border: #333;
    --pp-primary: #4da6ff;
    --pp-primary-hover: #80bfff;
    --pp-section-bg: #16213e;
    --pp-header-bg: #0f0f23;
    --pp-footer-bg: #0f0f23;
    --pp-meta-bg: #1e2a4a;
    --pp-meta-border: #2d3f6a;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: var(--pp-bg);
    color: var(--pp-text);
    line-height: 1.8;
    -webkit-font-smoothing: antialiased;
  }

  .privacy-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .privacy-page-header {
    background: var(--pp-header-bg);
    border-bottom: 1px solid var(--pp-border);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .privacy-page-logo {
    font-size: 20px;
    font-weight: 800;
    color: var(--pp-primary);
    text-decoration: none;
  }

  .privacy-page-logo:hover {
    color: var(--pp-primary-hover);
  }

  .privacy-page-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--pp-text-secondary);
    padding-left: 16px;
    border-left: 1px solid var(--pp-border);
  }

  .privacy-page-main {
    flex: 1;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 24px;
    width: 100%;
  }

  .privacy-page-heading {
    font-size: 26px;
    font-weight: 800;
    color: var(--pp-primary);
    margin-bottom: 20px;
    text-align: center;
  }

  .privacy-page-meta {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    padding: 12px 16px;
    background: var(--pp-meta-bg);
    border: 1px solid var(--pp-meta-border);
    border-radius: 8px;
    font-size: 13px;
    color: var(--pp-text-secondary);
    margin-bottom: 24px;
  }

  .privacy-page-intro {
    font-size: 15px;
    color: var(--pp-text-secondary);
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--pp-border);
  }

  .privacy-page-section {
    margin-bottom: 28px;
  }

  .privacy-page-section h2 {
    font-size: 17px;
    font-weight: 700;
    color: var(--pp-primary);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--pp-primary);
    display: inline-block;
  }

  .privacy-page-section-content {
    font-size: 14px;
    line-height: 1.9;
    color: var(--pp-text);
    padding: 16px;
    background: var(--pp-section-bg);
    border-radius: 8px;
    border: 1px solid var(--pp-border);
  }

  .privacy-page-section-content strong {
    color: var(--pp-text);
    font-weight: 600;
  }

  .privacy-page-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid var(--pp-border);
  }

  .privacy-page-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    border: 1px solid var(--pp-border);
    color: var(--pp-text);
    background: var(--pp-bg);
    cursor: pointer;
    transition: all 0.2s;
  }

  .privacy-page-btn:hover {
    border-color: var(--pp-primary);
    color: var(--pp-primary);
  }

  .privacy-page-btn-primary {
    background: var(--pp-primary);
    color: #fff;
    border-color: var(--pp-primary);
  }

  .privacy-page-btn-primary:hover {
    background: var(--pp-primary-hover);
    color: #fff;
  }

  .privacy-page-footer {
    background: var(--pp-footer-bg);
    border-top: 1px solid var(--pp-border);
    padding: 20px 24px;
    text-align: center;
    font-size: 13px;
    color: var(--pp-text-secondary);
  }

  .privacy-page-footer p {
    margin: 4px 0;
  }

  @media (max-width: 640px) {
    .privacy-page-main {
      padding: 24px 16px;
    }

    .privacy-page-meta {
      flex-direction: column;
      gap: 4px;
    }

    .privacy-page-actions {
      flex-direction: column;
    }

    .privacy-page-btn {
      justify-content: center;
    }
  }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', render);
