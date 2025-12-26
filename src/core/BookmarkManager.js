/**
 * BookmarkManager - 북마크(뷰 저장) 관리자
 * 지도 뷰 상태를 저장하고 복원하는 기능
 */

import { mapManager } from './MapManager.js';
import { eventBus } from '../utils/EventBus.js';

const STORAGE_KEY = 'egis_bookmarks';

class BookmarkManager {
  constructor() {
    this.bookmarks = [];
    this.loadFromStorage();
  }

  /**
   * 로컬 스토리지에서 북마크 로드
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.bookmarks = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('북마크 로드 실패:', e);
      this.bookmarks = [];
    }
  }

  /**
   * 로컬 스토리지에 북마크 저장
   */
  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bookmarks));
    } catch (e) {
      console.warn('북마크 저장 실패:', e);
    }
  }

  /**
   * 현재 뷰를 북마크로 저장
   * @param {string} name - 북마크 이름
   * @param {string} description - 설명 (선택)
   * @returns {Object} 생성된 북마크
   */
  addBookmark(name, description = '') {
    const view = mapManager.getView();
    if (!view) {
      throw new Error('지도가 초기화되지 않았습니다.');
    }

    const center = view.getCenter();
    const zoom = view.getZoom();
    const rotation = view.getRotation();

    const bookmark = {
      id: 'bookmark-' + Date.now(),
      name: name,
      description: description,
      center: center,
      zoom: zoom,
      rotation: rotation,
      createdAt: new Date().toISOString()
    };

    this.bookmarks.push(bookmark);
    this.saveToStorage();

    eventBus.emit('bookmark:added', { bookmark });

    return bookmark;
  }

  /**
   * 북마크로 이동
   * @param {string} bookmarkId - 북마크 ID
   */
  goToBookmark(bookmarkId) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) {
      throw new Error('북마크를 찾을 수 없습니다.');
    }

    const view = mapManager.getView();
    if (!view) return;

    view.animate({
      center: bookmark.center,
      zoom: bookmark.zoom,
      rotation: bookmark.rotation || 0,
      duration: 500
    });

    eventBus.emit('bookmark:visited', { bookmark });
  }

  /**
   * 북마크 삭제
   * @param {string} bookmarkId - 북마크 ID
   */
  removeBookmark(bookmarkId) {
    const index = this.bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) return;

    const removed = this.bookmarks.splice(index, 1)[0];
    this.saveToStorage();

    eventBus.emit('bookmark:removed', { bookmark: removed });
  }

  /**
   * 북마크 이름 변경
   * @param {string} bookmarkId - 북마크 ID
   * @param {string} newName - 새 이름
   */
  renameBookmark(bookmarkId, newName) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;

    bookmark.name = newName;
    this.saveToStorage();

    eventBus.emit('bookmark:updated', { bookmark });
  }

  /**
   * 북마크 설명 수정
   * @param {string} bookmarkId - 북마크 ID
   * @param {string} description - 새 설명
   */
  updateDescription(bookmarkId, description) {
    const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;

    bookmark.description = description;
    this.saveToStorage();

    eventBus.emit('bookmark:updated', { bookmark });
  }

  /**
   * 모든 북마크 가져오기
   * @returns {Array} 북마크 배열
   */
  getAllBookmarks() {
    return [...this.bookmarks];
  }

  /**
   * 북마크 개수
   * @returns {number}
   */
  getCount() {
    return this.bookmarks.length;
  }

  /**
   * 모든 북마크 삭제
   */
  clearAll() {
    this.bookmarks = [];
    this.saveToStorage();
    eventBus.emit('bookmark:cleared');
  }

  /**
   * 북마크 내보내기 (JSON)
   * @returns {string} JSON 문자열
   */
  exportBookmarks() {
    return JSON.stringify(this.bookmarks, null, 2);
  }

  /**
   * 북마크 가져오기 (JSON)
   * @param {string} jsonString - JSON 문자열
   */
  importBookmarks(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      if (!Array.isArray(imported)) {
        throw new Error('올바른 형식이 아닙니다.');
      }

      // ID 중복 방지를 위해 새 ID 부여
      imported.forEach(bookmark => {
        bookmark.id = 'bookmark-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        this.bookmarks.push(bookmark);
      });

      this.saveToStorage();
      eventBus.emit('bookmark:imported', { count: imported.length });

      return imported.length;
    } catch (e) {
      throw new Error('북마크 가져오기 실패: ' + e.message);
    }
  }
}

export const bookmarkManager = new BookmarkManager();
