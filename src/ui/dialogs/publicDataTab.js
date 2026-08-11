// © 2026 김용현
/**
 * publicDataTab - 데이터 불러오기 다이얼로그의 '공공데이터' 탭 내용.
 *
 * BuiltinDataDialog는 이미 1,000줄이 넘어 탭 자리만 내주고, 내용은 여기서 만든다.
 *
 * 목록·데이터는 모두 /api/pubdata(중계 함수)에서 받는다. 서비스키는 서버에만 있고
 * 엔드포인트·좌표 필드 매핑도 서버 사정이라, 이 파일은 그것들을 알지 못한다.
 */

/** 목록은 자주 바뀌지 않는다. 다이얼로그를 여닫을 때마다 다시 부르지 않는다. */
let cachedItems = null;

/** 안내/오류 문구 한 줄 */
export function renderNotice(message) {
  return `<div class="public-data-notice">${message}</div>`;
}

/** 카탈로그 목록 → 고를 수 있는 버튼들 */
export function renderCatalogList(items) {
  if (!items || items.length === 0) {
    return renderNotice('불러올 수 있는 공공데이터가 없습니다.');
  }

  const rows = items.map(item => `
    <button class="public-data-item" data-pubdata-id="${item.id}">
      <span class="public-data-item-name">${item.name}</span>
      <span class="public-data-item-desc">${item.description || ''}</span>
    </button>
  `).join('');

  return `<div class="public-data-list">${rows}</div>`;
}

export const publicDataTab = {
  /** 탭이 처음 열리기 전까지 보여줄 자리 */
  render() {
    return `<div class="public-data-tab" data-public-data-root>${renderNotice('불러오는 중…')}</div>`;
  },

  /**
   * 탭이 열릴 때 목록을 채운다.
   * @param {HTMLElement} root 탭 콘텐츠 요소
   * @param {Object} [options]
   * @param {Function} [options.fetchFn] 테스트에서 주입
   */
  async mount(root, options = {}) {
    if (!root) return;
    const fetchFn = options.fetchFn || ((url) => fetch(url));

    if (cachedItems) {
      root.innerHTML = renderCatalogList(cachedItems);
      return;
    }

    root.innerHTML = renderNotice('목록을 불러오는 중…');

    try {
      const response = await fetchFn('/api/pubdata?list=1');
      const body = await response.json();

      if (!response.ok) {
        root.innerHTML = renderNotice(body && body.error ? body.error : '목록을 불러오지 못했습니다.');
        return;
      }

      cachedItems = (body && body.items) || [];
      root.innerHTML = renderCatalogList(cachedItems);
    } catch (e) {
      // 로컬에서 `vite dev`만 띄우면 /api가 없어 여기로 온다
      root.innerHTML = renderNotice('목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  },

  /** 테스트·개발용 — 받아둔 목록을 지운다 */
  _resetCache() {
    cachedItems = null;
  }
};
