// © 2026 김용현
/**
 * askText - 텍스트 입력 대화상자 (Promise<string|null>)
 *
 * Electron은 window.prompt()를 지원하지 않아 데스크톱 앱의 e-GIS 탭(webview)에서는
 * prompt 호출이 예외를 던진다(저장/이름변경 메뉴가 조용히 죽는 원인).
 * → 데스크톱(주입 브릿지 window.egisDesktop 존재)에서는 모달로, 브라우저에서는 기존 prompt로.
 */
export function askText(message, defaultValue = '') {
  if (!window.egisDesktop) {
    return Promise.resolve(window.prompt(message, defaultValue));
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '10000';

    const content = document.createElement('div');
    content.className = 'modal-content';
    content.style.maxWidth = '360px';

    const body = document.createElement('div');
    body.className = 'modal-body';
    const label = document.createElement('p');
    label.textContent = message;
    label.style.marginBottom = '8px';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue || '';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 8px;font:inherit;';
    body.append(label, input);

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = '취소';
    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary';
    okBtn.textContent = '확인';
    footer.append(cancelBtn, okBtn);

    content.append(body, footer);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    function close(result) {
      overlay.remove();
      resolve(result);
    }
    okBtn.addEventListener('click', () => close(input.value));
    cancelBtn.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); close(input.value); }
      else if (e.key === 'Escape') { e.preventDefault(); close(null); }
    });
    input.focus();
    input.select();
  });
}
