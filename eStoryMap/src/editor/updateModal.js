// © 2026 김용현
// eStoryMap/src/editor/updateModal.js
// 업데이트 알림창 — 새 버전 발견 시 릴리스 노트 + 다운로드 링크(GitHub 릴리스 페이지).
// 알림 전용(자동 설치 아님). 릴리스 노트는 원문 텍스트로만 표시(안전).

/**
 * @param {{version:string, name?:string, notes?:string, url?:string, downloadUrl?:string}} info
 */
export function showUpdateModal({ version, name, notes, url, downloadUrl }) {
  const back = document.createElement('div');
  back.className = 'update-back';

  const box = document.createElement('div');
  box.className = 'update-box';

  const h = document.createElement('h2');
  h.className = 'update-title';
  h.textContent = `새 버전 ${version} 이(가) 나왔습니다`;

  if (name && name !== version && name !== `v${version}`) {
    const sub = document.createElement('div');
    sub.className = 'update-sub';
    sub.textContent = name;
    box.appendChild(h);
    box.appendChild(sub);
  } else {
    box.appendChild(h);
  }

  const notesLabel = document.createElement('div');
  notesLabel.className = 'update-notes-label';
  notesLabel.textContent = '업데이트 내역';
  const body = document.createElement('div');
  body.className = 'update-notes'; // white-space: pre-wrap (CSS)
  body.textContent = (notes && notes.trim()) || '새로운 버전이 준비되어 있습니다.';
  box.append(notesLabel, body);

  // 안내: 아래 버튼을 누르면 무엇이 일어나는지 명시(릴리스 노트와 무관하게 일관)
  const guide = document.createElement('div');
  guide.className = 'update-guide';
  guide.textContent = downloadUrl
    ? '👇 아래 “설치 파일 다운로드”를 누르면 최신 설치본이 바로 내려받아집니다. 받은 파일을 실행해 설치하세요.'
    : '👇 아래 “릴리스 페이지 열기”에서 최신 설치본을 받아 설치하세요.';
  box.appendChild(guide);

  const actions = document.createElement('div');
  actions.className = 'update-actions';
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'update-later';
  later.textContent = '나중에';
  const dl = document.createElement('button');
  dl.type = 'button';
  dl.className = 'update-download';
  // 설치 파일이 릴리스에 첨부돼 있으면 바로 다운로드, 아니면 릴리스 페이지로
  dl.textContent = downloadUrl ? '설치 파일 다운로드' : '릴리스 페이지 열기';
  actions.append(later, dl);
  box.appendChild(actions);

  function close() { back.remove(); }
  later.addEventListener('click', close);
  dl.addEventListener('click', () => {
    const target = downloadUrl || url;
    if (target && window.egisFS && window.egisFS.openExternal) window.egisFS.openExternal(target);
    close();
  });
  back.addEventListener('click', (e) => { if (e.target === back) close(); }); // 바깥 클릭 닫기

  back.appendChild(box);
  document.body.appendChild(back);
}
