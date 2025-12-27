/**
 * BookmarkPanel - 북마크 관리 패널
 */

import { bookmarkManager } from '../../core/BookmarkManager.js';
import { eventBus } from '../../utils/EventBus.js';

class BookmarkPanel {
  constructor() {
    this.modal = null;
    this.init();
  }

  /**
   * 이벤트 리스너 초기화
   */
  init() {
    eventBus.on('bookmark:added', () => this.refreshList());
    eventBus.on('bookmark:removed', () => this.refreshList());
    eventBus.on('bookmark:updated', () => this.refreshList());
    eventBus.on('bookmark:imported', () => this.refreshList());
    eventBus.on('bookmark:cleared', () => this.refreshList());
  }

  /**
   * 패널 열기
   */
  show() {
    this.render();
  }

  /**
   * 모달 렌더링
   */
  render() {
    this.close();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay bookmark-modal active';
    this.modal.innerHTML = this.getModalHTML();
    document.body.appendChild(this.modal);

    this.bindEvents();
    this.refreshList();
  }

  /**
   * 모달 HTML 생성
   */
  getModalHTML() {
    return '<div class="modal-content bookmark-content">' +
      '<div class="modal-header">' +
        '<h3>북마크</h3>' +
        '<button class="modal-close" id="bookmark-close">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="bookmark-add-section">' +
          '<input type="text" id="bookmark-name" placeholder="북마크 이름" />' +
          '<button class="btn btn-primary btn-sm" id="bookmark-add">현재 뷰 저장</button>' +
        '</div>' +
        '<div class="bookmark-list-section">' +
          '<div class="bookmark-list" id="bookmark-list">' +
            '<p class="no-bookmarks">저장된 북마크가 없습니다.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary btn-sm" id="bookmark-import">가져오기</button>' +
        '<button class="btn btn-secondary btn-sm" id="bookmark-export">내보내기</button>' +
        '<button class="btn btn-secondary" id="bookmark-done">닫기</button>' +
      '</div>' +
    '</div>';
  }

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    const closeBtn = document.getElementById('bookmark-close');
    const doneBtn = document.getElementById('bookmark-done');
    const addBtn = document.getElementById('bookmark-add');
    const nameInput = document.getElementById('bookmark-name');
    const importBtn = document.getElementById('bookmark-import');
    const exportBtn = document.getElementById('bookmark-export');

    closeBtn.addEventListener('click', () => this.close());
    doneBtn.addEventListener('click', () => this.close());

    });

    // 북마크 추가
    addBtn.addEventListener('click', () => this.addBookmark());
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addBookmark();
    });

    // 가져오기/내보내기
    importBtn.addEventListener('click', () => this.importBookmarks());
    exportBtn.addEventListener('click', () => this.exportBookmarks());

    // 북마크 리스트 이벤트 위임
    document.getElementById('bookmark-list').addEventListener('click', (e) => {
      const item = e.target.closest('.bookmark-item');
      if (!item) return;

      const bookmarkId = item.dataset.id;

      if (e.target.closest('.bookmark-delete')) {
        this.deleteBookmark(bookmarkId);
      } else if (e.target.closest('.bookmark-goto')) {
        this.goToBookmark(bookmarkId);
      } else {
        // 항목 클릭 시 이동
        this.goToBookmark(bookmarkId);
      }
    });
  }

  /**
   * 북마크 목록 새로고침
   */
  refreshList() {
    const listEl = document.getElementById('bookmark-list');
    if (!listEl) return;

    const bookmarks = bookmarkManager.getAllBookmarks();

    if (bookmarks.length === 0) {
      listEl.innerHTML = '<p class="no-bookmarks">저장된 북마크가 없습니다.</p>';
      return;
    }

    listEl.innerHTML = bookmarks.map(bookmark => {
      const date = new Date(bookmark.createdAt).toLocaleDateString('ko-KR');
      return '<div class="bookmark-item" data-id="' + bookmark.id + '">' +
        '<div class="bookmark-info">' +
          '<span class="bookmark-name">' + this.escapeHtml(bookmark.name) + '</span>' +
          '<span class="bookmark-date">' + date + '</span>' +
        '</div>' +
        '<div class="bookmark-actions">' +
          '<button class="btn-icon btn-small bookmark-goto" title="이동">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<circle cx="12" cy="12" r="10"/>' +
              '<circle cx="12" cy="12" r="3"/>' +
            '</svg>' +
          '</button>' +
          '<button class="btn-icon btn-small bookmark-delete" title="삭제">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<line x1="18" y1="6" x2="6" y2="18"/>' +
              '<line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /**
   * 북마크 추가
   */
  addBookmark() {
    const nameInput = document.getElementById('bookmark-name');
    const name = nameInput.value.trim();

    if (!name) {
      alert('북마크 이름을 입력해주세요.');
      nameInput.focus();
      return;
    }

    try {
      bookmarkManager.addBookmark(name);
      nameInput.value = '';
      nameInput.focus();
    } catch (error) {
      alert('북마크 저장 실패: ' + error.message);
    }
  }

  /**
   * 북마크로 이동
   */
  goToBookmark(bookmarkId) {
    try {
      bookmarkManager.goToBookmark(bookmarkId);
    } catch (error) {
      alert(error.message);
    }
  }

  /**
   * 북마크 삭제
   */
  deleteBookmark(bookmarkId) {
    if (confirm('이 북마크를 삭제하시겠습니까?')) {
      bookmarkManager.removeBookmark(bookmarkId);
    }
  }

  /**
   * 북마크 내보내기
   */
  exportBookmarks() {
    const bookmarks = bookmarkManager.getAllBookmarks();
    if (bookmarks.length === 0) {
      alert('내보낼 북마크가 없습니다.');
      return;
    }

    const json = bookmarkManager.exportBookmarks();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'egis_bookmarks.json';
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * 북마크 가져오기
   */
  importBookmarks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const count = bookmarkManager.importBookmarks(text);
        alert(`${count}개의 북마크를 가져왔습니다.`);
      } catch (error) {
        alert(error.message);
      }
    };

    input.click();
  }

  /**
   * HTML 이스케이프
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 모달 닫기
   */
  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

export const bookmarkPanel = new BookmarkPanel();
