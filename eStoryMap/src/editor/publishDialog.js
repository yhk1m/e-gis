// © 2026 김용현
// eStoryMap/src/editor/publishDialog.js
// 게시 대화상자(접착) — 미게시: 확인→게시. 게시됨: 링크 표시+[재게시][링크 복사][게시 취소].
// 게시 상태의 단일 진실원은 doc.meta.publish(Publisher가 갱신) — 이 UI는 그것만 읽는다.
import { confirmDialog } from './confirmDialog.js';
import { publicUrl } from '../core/Publisher.js';
import { serializeStoryDoc } from '../core/LocalStore.js';

const SIZE_WARN_BYTES = 10 * 1024 * 1024; // 게시는 허용하되 로딩 경고만

/**
 * @param {{doc:object, publisher:object, openExternal:(url:string)=>void, onChanged:()=>void}} deps
 *  - onChanged: 게시/취소로 meta.publish가 바뀐 뒤 호출(호출부에서 scheduleSave)
 */
export function openPublishDialog({ doc, publisher, openExternal, onChanged }) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  const box = document.createElement('div');
  box.className = 'confirm-box publish-box';
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  function btn(text, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function render(doneMsg = '') {
    box.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'confirm-msg';
    const note = document.createElement('div');
    note.className = 'publish-note';
    note.textContent = doneMsg;
    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    async function doPublish(successMsg) {
      note.textContent = '게시 중…';
      try {
        await publisher.publish(doc);
        onChanged();
        render(successMsg);
      } catch (e) {
        note.textContent = `게시 실패: ${e.message}`;
      }
    }

    if (doc.meta.publish) {
      const url = publicUrl(doc.meta.publish);
      msg.textContent = '이 스토리맵은 웹에 게시돼 있어요. 링크가 있으면 누구나 볼 수 있어요.';
      const urlInput = document.createElement('input');
      urlInput.className = 'publish-url';
      urlInput.readOnly = true;
      urlInput.value = url;
      urlInput.addEventListener('focus', () => urlInput.select());
      actions.append(
        btn('링크 복사', 'confirm-cancel', async () => {
          try {
            await navigator.clipboard.writeText(url);
            note.textContent = '링크를 복사했어요.';
          } catch {
            urlInput.focus(); // 클립보드 권한 실패 시 수동 복사 유도
            note.textContent = 'Ctrl+C로 복사해 주세요.';
          }
        }),
        btn('브라우저에서 열기', 'confirm-cancel', () => openExternal(url)),
        btn('재게시', 'confirm-ok primary', () => doPublish('다시 게시했어요. 링크가 지금 문서로 바뀌었어요.')),
        btn('게시 취소', 'confirm-ok danger', async () => {
          if (!(await confirmDialog('게시를 취소할까요? 링크가 더 이상 열리지 않아요.', { confirmText: '게시 취소' }))) return;
          try {
            await publisher.unpublish(doc);
            onChanged();
            render('게시를 취소했어요.');
          } catch (e) {
            note.textContent = `실패: ${e.message}`;
          }
        }),
        btn('닫기', 'confirm-cancel', close),
      );
      box.append(msg, urlInput, note, actions);
    } else {
      msg.textContent = '이 스토리맵을 웹에 게시할까요? 링크가 있으면 누구나 볼 수 있어요.';
      if (!doneMsg && serializeStoryDoc(doc).length > SIZE_WARN_BYTES) {
        note.textContent = '문서가 10MB를 넘어요. 게시는 되지만 보는 사람 화면이 늦게 열릴 수 있어요.';
      }
      actions.append(
        btn('취소', 'confirm-cancel', close),
        btn('게시', 'confirm-ok primary', () => doPublish('게시했어요. 위 링크를 나눠 주세요.')),
      );
      box.append(msg, note, actions);
    }
  }

  render();
}
