// © 2026 김용현
// eStoryMap/src/editor/StartScreen.js
// 시작 화면: 새 스토리맵 만들기 / 저장된 .esm 목록에서 열기(상위 스펙 §3b)
// + 하단 로그인 영역(M7): 로그아웃 폼 / 로그인 표시 / 에러 라인. 로그인 없이 로컬 기능 전부 동작.
// 오버레이 표시/숨김은 main.js가 담당하고, 이 컴포넌트는 내용만 렌더한다.
// 인증 상태는 updateAuth({user})로 외부(main.js)에서 밀어넣는다 — render(projectNames)와 같은 단방향.

import { setIconLabel } from '../shared/icons.js';

/**
 * @param {HTMLElement} container
 * @param {{onCreate(title:string):void, onOpen(name:string):void,
 *          auth?: {signIn(email:string,pw:string):Promise<object>, signOut():Promise<void>, openSignup():void}}} handlers
 *        auth 미주입 시 로그인 영역을 렌더하지 않는다(테스트·이전 계약 유지).
 */
export function createStartScreen(container, {
  onCreate, onOpen, onOpenCloud, auth,
  onRename, onDuplicate, onDelete, onRenameCloud, onDeleteCloud, onImport,
}) {
  let errorEl = null;
  let authBox = null;
  let authUser = null;  // updateAuth로 갱신되는 유일한 인증 상태
  let authBusy = false; // 로그인 요청 중 중복 제출 방지
  let cloudBox = null;
  let cloudItems = null;
  let cloudNote = null; // {message, retry?}: 불러오는 중이거나 실패했을 때 목록 대신 보여 줄 안내 // null=미로드/비로그인(섹션 숨김), []=비었음 안내 — renderCloud로 갱신(M8)

  function render(projectNames) {
    closeMenu();
    container.innerHTML = '';
    authBox = null;
    cloudBox = null;
    const box = document.createElement('div');
    box.className = 'start-box';

    const brand = document.createElement('h1');
    brand.className = 'start-brand';
    const brandE = document.createElement('span');
    brandE.className = 'brand-e';
    brandE.textContent = 'e';
    brand.append(brandE, document.createTextNode('-GIStory')); // 'e'만 파란색(브랜드 강조)
    box.appendChild(brand);

    const row = document.createElement('div');
    row.className = 'start-new';
    const title = document.createElement('input');
    title.type = 'text';
    title.id = 'start-title';
    title.placeholder = '새 스토리맵 제목';
    const create = document.createElement('button');
    create.type = 'button';
    create.id = 'btn-start-create';
    create.textContent = '새로 만들기';
    create.addEventListener('click', () => onCreate(title.value.trim() || '새 스토리맵'));
    title.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 한글 IME 조합 중 Enter 무시
      if (e.key === 'Enter') create.click();
    });
    row.appendChild(title);
    row.appendChild(create);
    box.appendChild(row);

    errorEl = document.createElement('div');
    errorEl.className = 'start-error';
    box.appendChild(errorEl);

    const listTitle = document.createElement('div');
    listTitle.className = 'start-list-title';
    listTitle.textContent = '저장된 스토리맵';
    box.appendChild(listTitle);

    if (!projectNames.length) {
      const empty = document.createElement('div');
      empty.className = 'start-empty';
      empty.textContent = '아직 저장된 스토리맵이 없어요';
      box.appendChild(empty);
    } else {
      for (const name of projectNames) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'start-item';
        item.textContent = name;
        item.addEventListener('click', () => onOpen(name));
        box.appendChild(withMenu(item, name, [
          onRename && { icon: 'edit', label: '이름 바꾸기', run: (row) => startRename(row, name, (to) => onRename(name, to)) },
          onDuplicate && { icon: 'copy', label: '사본 만들기', run: () => onDuplicate(name) },
          onDelete && { icon: 'trash', label: '지우기', danger: true, run: () => onDelete(name) },
        ]));
      }
    }

    if (onImport) {
      const imp = document.createElement('button');
      imp.type = 'button';
      imp.id = 'btn-start-import';
      imp.className = 'start-import';
      setIconLabel(imp, 'folderOpen', '다른 곳에 있는 파일 열기');
      imp.title = 'USB나 메일로 받은 스토리맵 파일(.esm)을 골라 열어요. 저장 폴더로 복사해 둬요';
      imp.addEventListener('click', () => onImport());
      box.appendChild(imp);
    }

    if (auth) {
      cloudBox = document.createElement('div');
      cloudBox.className = 'start-cloud';
      box.appendChild(cloudBox);
      renderCloudSection();

      authBox = document.createElement('div');
      authBox.className = 'start-auth';
      box.appendChild(authBox);
      renderAuth();
    }

    container.appendChild(box);
  }

  function renderCloudSection() {
    if (!cloudBox) return;
    if (openMenu && cloudBox.contains(openMenu.menu)) closeMenu();
    cloudBox.innerHTML = '';
    if (!cloudItems && !cloudNote) return; // 비로그인 — 섹션 자체를 그리지 않는다
    const title = document.createElement('div');
    title.className = 'start-list-title';
    title.textContent = '클라우드 스토리맵';
    cloudBox.appendChild(title);
    if (cloudNote) {
      // 불러오는 중이거나 불러오지 못했을 때
      const note = document.createElement('div');
      note.className = 'start-empty';
      note.textContent = cloudNote.message;
      cloudBox.appendChild(note);
      if (cloudNote.retry) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'start-retry';
        retry.textContent = '다시 불러오기';
        retry.addEventListener('click', cloudNote.retry);
        cloudBox.appendChild(retry);
      }
      return;
    }
    if (!cloudItems.length) {
      const empty = document.createElement('div');
      empty.className = 'start-empty';
      empty.textContent = '클라우드에 저장된 스토리맵이 없어요';
      cloudBox.appendChild(empty);
    } else {
      for (const item of cloudItems) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'start-item cloud-item';
        setIconLabel(btn, 'cloud', item.title);
        btn.addEventListener('click', () => { if (onOpenCloud) onOpenCloud(item.id); });
        cloudBox.appendChild(withMenu(btn, item.title, [
          onRenameCloud && { icon: 'edit', label: '이름 바꾸기', run: (row) => startRename(row, item.title, (to) => onRenameCloud(item.id, item.title, to)) },
          onDeleteCloud && { icon: 'trash', label: '클라우드에서 지우기', danger: true, run: () => onDeleteCloud(item.id, item.title) },
        ]));
      }
    }
  }

  let openMenu = null; // 지금 열린 항목 메뉴(한 번에 하나)

  function closeMenu() {
    if (!openMenu) return;
    openMenu.menu.remove();
    openMenu.btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onMenuKey, true);
    openMenu = null;
  }
  function onOutside(e) {
    if (!openMenu) return;
    if (openMenu.menu.contains(e.target) || openMenu.btn.contains(e.target)) return;
    closeMenu();
  }
  function onMenuKey(e) {
    if (e.key === 'Escape' && openMenu) {
      const btn = openMenu.btn;
      closeMenu();
      btn.focus();
    }
  }

  /** 목록 항목 옆에 「더 보기」 버튼과 메뉴(이름 바꾸기, 사본, 지우기)를 붙인 줄을 만든다. */
  function withMenu(item, name, actions) {
    const list = actions.filter(Boolean);
    if (!list.length) return item; // 핸들러가 없으면 예전처럼 항목만(테스트, 이전 계약)
    const row = document.createElement('div');
    row.className = 'start-row';
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'start-more';
    more.title = '더 보기';
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    setIconLabel(more, 'more', '', `「${name}」 더 보기`);
    more.addEventListener('click', () => {
      const wasMine = openMenu && openMenu.btn === more;
      closeMenu();
      if (wasMine) return;
      const menu = document.createElement('div');
      menu.className = 'start-menu';
      menu.setAttribute('role', 'menu');
      for (const a of list) {
        const mi = document.createElement('button');
        mi.type = 'button';
        mi.className = 'start-menu-item' + (a.danger ? ' danger' : '');
        mi.setAttribute('role', 'menuitem');
        setIconLabel(mi, a.icon, a.label);
        mi.addEventListener('click', () => { closeMenu(); a.run(row); });
        menu.appendChild(mi);
      }
      row.appendChild(menu);
      more.setAttribute('aria-expanded', 'true');
      openMenu = { menu, btn: more };
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onMenuKey, true);
      const first = menu.querySelector('button');
      if (first) first.focus();
    });
    row.append(item, more);
    return row;
  }

  /** 줄 안에서 이름을 바로 고친다. Enter나 칸 밖을 누르면 저장, Esc는 그대로 둔다. */
  function startRename(row, current, commit) {
    const item = row.querySelector('.start-item');
    const more = row.querySelector('.start-more');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'start-rename';
    input.value = current;
    input.setAttribute('aria-label', '새 이름');
    item.hidden = true;
    more.hidden = true;
    row.insertBefore(input, item);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const to = input.value.trim();
      input.remove();
      item.hidden = false;
      more.hidden = false;
      if (save && to && to !== current) commit(to);
    };
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 한글 IME 조합 중 Enter 무시
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') { e.stopPropagation(); finish(false); item.focus(); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  /** 클라우드 목록 반영(M8). render 전에 불려도 안전 — 상태만 저장, 다음 render에 반영. */
  function renderCloud(items) {
    cloudItems = items || null;
    cloudNote = null;
    renderCloudSection();
  }

  /** 클라우드 목록을 불러오는 중. */
  function renderCloudLoading() {
    cloudNote = { message: '클라우드 목록을 불러오고 있어요' };
    renderCloudSection();
  }

  /** 클라우드 목록을 불러오지 못했을 때: 안내와 다시 불러오기 버튼. */
  function renderCloudError(message, retry) {
    cloudItems = null;
    cloudNote = { message, retry };
    renderCloudSection();
  }

  function renderAuth() {
    if (!authBox) return;
    authBox.innerHTML = '';
    if (authUser) {
      const row = document.createElement('div');
      row.className = 'auth-row';
      const who = document.createElement('span');
      who.className = 'auth-user';
      who.textContent = `${authUser.email} 님`;
      const logout = document.createElement('button');
      logout.type = 'button';
      logout.id = 'btn-auth-logout';
      logout.textContent = '로그아웃';
      logout.addEventListener('click', async () => {
        logout.disabled = true; // 연타로 signOut 중복 호출 방지(로그인 버튼과 동일 패턴)
        try {
          await auth.signOut();
        } catch (e) {
          showAuthError((e && e.message) || '로그아웃하지 못했어요. 다시 해 주세요.'); // 원래 throw하지 않는 계약이지만 방어
        } finally {
          if (logout.isConnected) logout.disabled = false; // updateAuth로 DOM 교체됐으면 불필요
        }
      });
      row.appendChild(who);
      row.appendChild(logout);
      authBox.appendChild(row);
    } else {
      const row = document.createElement('div');
      row.className = 'auth-row';
      const email = document.createElement('input');
      email.type = 'email';
      email.id = 'auth-email';
      email.placeholder = '이메일 (e-GIS 계정)';
      const pw = document.createElement('input');
      pw.type = 'password';
      pw.id = 'auth-password';
      pw.placeholder = '비밀번호';
      const login = document.createElement('button');
      login.type = 'button';
      login.id = 'btn-auth-login';
      login.textContent = '로그인';
      login.addEventListener('click', submit);
      for (const input of [email, pw]) {
        input.addEventListener('keydown', (e) => {
          if (e.isComposing || e.keyCode === 229) return; // 한글 IME 조합 중 Enter 무시
          if (e.key === 'Enter') submit();
        });
      }
      row.appendChild(email);
      row.appendChild(pw);
      row.appendChild(login);
      authBox.appendChild(row);

      const signup = document.createElement('button');
      signup.type = 'button';
      signup.id = 'auth-signup-link';
      signup.className = 'auth-signup';
      signup.textContent = '계정이 없나요? e-GIS에서 가입';
      signup.addEventListener('click', () => auth.openSignup());
      authBox.appendChild(signup);
    }
    const err = document.createElement('div');
    err.className = 'auth-error';
    authBox.appendChild(err);
  }

  async function submit() {
    if (authBusy || !authBox) return;
    const email = authBox.querySelector('#auth-email').value.trim();
    const pw = authBox.querySelector('#auth-password').value; // 비밀번호는 트림하지 않는다
    if (!email || !pw) {
      showAuthError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    authBusy = true;
    const btn = authBox.querySelector('#btn-auth-login');
    if (btn) btn.disabled = true;
    try {
      showAuthError('');
      await auth.signIn(email, pw);
      // 성공 시 UI 전환은 main.js의 authManager.onChange → updateAuth가 담당(단방향)
    } catch (e) {
      showAuthError((e && e.message) || '로그인하지 못했어요. 다시 해 주세요.'); // 비-Error throw 방어
    } finally {
      authBusy = false;
      const b = authBox.querySelector('#btn-auth-login'); // 성공 시 renderAuth로 교체됐을 수 있음
      if (b) b.disabled = false;
    }
  }

  function showAuthError(message) {
    const el = authBox && authBox.querySelector('.auth-error');
    if (el) el.textContent = message;
  }

  /** 인증 상태 반영. render 전에 불려도 안전(상태만 저장, 다음 render에 반영). */
  function updateAuth({ user }) {
    authUser = user || null;
    renderAuth();
  }

  function showError(message) {
    if (errorEl) errorEl.textContent = message;
  }

  /** 이름으로 스토리맵을 연다(다른 곳에서 들여온 파일을 바로 열 때). */
  function openByName(name) {
    return onOpen(name);
  }

  return { render, showError, updateAuth, renderCloud, renderCloudLoading, renderCloudError, openByName };
}
