// © 2026 김용현
// eStoryMap/src/editor/loginDialog.js
// 편집 화면에서 바로 로그인하는 창. 게시하기나 클라우드 동기화를 누를 때 로그인이 안 돼 있으면 띄운다.
// 확인 창(confirmDialog)과 같은 겉모양을 쓴다. 로그인하면 true, 닫으면 false로 끝난다.

/**
 * @param {{signIn(email:string, pw:string):Promise<any>, openSignup():void}} auth
 * @param {{reason?:string}} [opts] - 왜 로그인이 필요한지 한 줄(예: 「웹에 게시하려면 로그인해 주세요.」)
 * @returns {Promise<boolean>}
 */
export function loginDialog(auth, { reason = '' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    const box = document.createElement('div');
    box.className = 'confirm-box login-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'e-GIS 계정으로 로그인');

    const title = document.createElement('div');
    title.className = 'login-title';
    title.textContent = 'e-GIS 계정으로 로그인';
    const msg = document.createElement('div');
    msg.className = 'confirm-msg';
    msg.textContent = reason;
    msg.hidden = !reason;

    const email = document.createElement('input');
    email.type = 'email';
    email.className = 'login-input';
    email.placeholder = '이메일';
    email.autocomplete = 'username';
    const pw = document.createElement('input');
    pw.type = 'password';
    pw.className = 'login-input';
    pw.placeholder = '비밀번호';
    pw.autocomplete = 'current-password';
    const err = document.createElement('div');
    err.className = 'auth-error';
    err.setAttribute('role', 'alert');

    const signup = document.createElement('button');
    signup.type = 'button';
    signup.className = 'auth-signup';
    signup.textContent = '계정이 없나요? e-GIS에서 가입';
    signup.addEventListener('click', () => auth.openSignup());

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'confirm-cancel';
    cancel.textContent = '닫기';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'confirm-ok primary';
    ok.textContent = '로그인';
    actions.append(cancel, ok);

    box.append(title, msg, email, pw, err, signup, actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    email.focus();

    let busy = false;
    function finish(result) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }
    async function submit() {
      if (busy) return;
      const e = email.value.trim();
      if (!e || !pw.value) {
        err.textContent = '이메일과 비밀번호를 입력해 주세요.';
        return;
      }
      busy = true;
      ok.disabled = true;
      err.textContent = '';
      try {
        await auth.signIn(e, pw.value);
        finish(true);
      } catch (ex) {
        err.textContent = (ex && ex.message) || '로그인하지 못했어요. 다시 해 주세요.';
      } finally {
        busy = false;
        ok.disabled = false;
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
      else if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && (e.target === email || e.target === pw)) submit();
    }
    document.addEventListener('keydown', onKey, true);
    cancel.addEventListener('click', () => finish(false));
    ok.addEventListener('click', submit);
  });
}
