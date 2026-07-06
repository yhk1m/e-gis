// © 2026 김용현
// eStoryMap/src/editor/confirmDialog.js
// 간단한 확인 다이얼로그 — 앱 내 테마 대응 모달. Promise<boolean> 반환(확인=true).
// 네이티브 window.confirm 대신 사용(테마 일관 + Electron 렌더러 신뢰성).

/**
 * @param {string} message
 * @param {{confirmText?:string, cancelText?:string, danger?:boolean}} [opts]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, { confirmText = '삭제', cancelText = '취소', danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const box = document.createElement('div');
    box.className = 'confirm-box';

    const msg = document.createElement('div');
    msg.className = 'confirm-msg';
    msg.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'confirm-cancel';
    cancel.textContent = cancelText;

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'confirm-ok' + (danger ? ' danger' : '');
    ok.textContent = confirmText;

    actions.append(cancel, ok);
    box.append(msg, actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    }
    cancel.addEventListener('click', () => close(false));
    ok.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); }); // 바깥 클릭=취소
    document.addEventListener('keydown', onKey, true);
    ok.focus();
  });
}
