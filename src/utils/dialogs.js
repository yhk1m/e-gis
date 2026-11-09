// © 2026 김용현
/**
 * e-GIS 안에 그리는 알림·확인·입력 창 (브라우저 기본 alert/confirm/prompt 대신).
 *
 * 크롬·엣지는 보안 때문에 기본 대화상자가 뜨는 순간 전체화면을 강제로 끈다.
 * 그래서 수업 중 전체화면으로 쓰다가 레이어를 지우거나 분석 알림이 뜨면 전체화면이 풀렸다.
 * 이 창들은 페이지 안의 요소라 전체화면이 그대로 유지된다.
 *
 * - showAlert(message)            → Promise<void>
 * - showConfirm(message, opts)    → Promise<boolean>
 * - showPrompt(message, default)  → Promise<string|null>
 *
 * Enter = 확인, Esc = 취소(알림은 닫기), 바깥 클릭 = 취소. 여러 개가 겹치면 나중 것이 위에 뜨고 키도 그것만 받는다.
 */

const stack = []; // 열린 창 (마지막이 맨 위)

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {Object} spec {message, title, okText, cancelText?, danger?, inputValue?}
 * @returns {Promise<{ok: boolean, value: string|null}>}
 */
function openDialog(spec) {
  return new Promise((resolve) => {
    const overlay = el('div', 'modal-overlay active egis-dialog-overlay');
    overlay.style.zIndex = String(10000 + stack.length);

    const box = el('div', 'modal egis-dialog');
    box.setAttribute('role', spec.cancelText ? 'alertdialog' : 'dialog');
    box.setAttribute('aria-modal', 'true');

    if (spec.title) {
      const header = el('div', 'modal-header');
      header.appendChild(el('h3', '', spec.title));
      box.appendChild(header);
    }

    const body = el('div', 'modal-body');
    body.appendChild(el('p', 'egis-dialog-message', spec.message == null ? '' : String(spec.message)));
    let input = null;
    if (spec.inputValue !== undefined) {
      input = el('input', 'egis-dialog-input');
      input.type = 'text';
      input.value = spec.inputValue == null ? '' : String(spec.inputValue);
      body.appendChild(input);
    }
    box.appendChild(body);

    const footer = el('div', 'modal-footer');
    let cancelBtn = null;
    if (spec.cancelText) {
      cancelBtn = el('button', 'btn btn-secondary egis-dialog-cancel', spec.cancelText);
      cancelBtn.type = 'button';
      footer.appendChild(cancelBtn);
    }
    const okBtn = el('button', `btn ${spec.danger ? 'btn-danger' : 'btn-primary'} egis-dialog-ok`, spec.okText);
    okBtn.type = 'button';
    footer.appendChild(okBtn);
    box.appendChild(footer);
    overlay.appendChild(box);

    const prevFocus = document.activeElement;
    let done = false;
    const entry = { overlay };

    function close(ok) {
      if (done) return;
      done = true;
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) {
        try { prevFocus.focus(); } catch (_) { /* 무시 */ }
      }
      resolve({ ok, value: ok && input ? input.value : null });
    }

    // 맨 위 창만 키를 받는다. 캡처 단계에서 잡아 뒤의 단축키(Delete·Esc 등)로 새지 않게 막는다.
    function onKey(e) {
      if (stack[stack.length - 1] !== entry) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); e.stopPropagation(); close(true); }
    }

    okBtn.addEventListener('click', () => close(true));
    if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey, true);

    stack.push(entry);
    document.body.appendChild(overlay);
    if (input) { input.focus(); input.select(); } else okBtn.focus();
  });
}

/** 알림 — 확인 버튼 하나. 닫힐 때 풀린다. */
export async function showAlert(message, { title = '', okText = '확인' } = {}) {
  await openDialog({ message, title, okText });
}

/** 확인 — 확인이면 true, 취소·Esc·바깥 클릭이면 false. danger:true 면 확인 버튼이 빨간색. */
export async function showConfirm(message, { title = '', okText = '확인', cancelText = '취소', danger = false } = {}) {
  const r = await openDialog({ message, title, okText, cancelText, danger });
  return r.ok;
}

/** 입력 — 확인이면 입력한 글자, 취소면 null (window.prompt 와 같은 약속). */
export async function showPrompt(message, defaultValue = '', { title = '', okText = '확인', cancelText = '취소' } = {}) {
  const r = await openDialog({ message, title, okText, cancelText, inputValue: defaultValue ?? '' });
  return r.ok ? r.value : null;
}
