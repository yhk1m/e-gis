/**
 * EventBus - 컴포넌트 간 이벤트 통신을 위한 싱글톤 클래스
 */
class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  /**
   * 이벤트 발생
   * @param {string} event - 이벤트 이름
   * @param {*} data - 전달할 데이터
   */
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }

  /**
   * 이벤트 리스너 제거
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 제거할 콜백 함수
   */
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  /**
   * 한 번만 실행되는 이벤트 리스너 등록
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

// 싱글톤 인스턴스 export
export const eventBus = new EventBus();

// 주요 이벤트 이름 상수
export const Events = {
  // 레이어 관련
  LAYER_ADDED: 'layer:added',
  LAYER_REMOVED: 'layer:removed',
  LAYER_VISIBILITY_CHANGED: 'layer:visibility',
  LAYER_SELECTED: 'layer:selected',
  LAYER_ORDER_CHANGED: 'layer:order',
  LAYER_STYLE_CHANGED: 'layer:stylechanged',

  // 피처 관련
  FEATURE_SELECTED: 'feature:selected',
  FEATURE_DESELECTED: 'feature:deselected',
  FEATURE_CREATED: 'feature:created',
  FEATURE_MODIFIED: 'feature:modified',
  FEATURE_DELETED: 'feature:deleted',
  FEATURE_CREATED: 'feature:created',
  FEATURE_MODIFY_START: 'feature:modifystart',
  HISTORY_CHANGED: 'history:changed',

  // 도구 관련
  TOOL_CHANGED: 'tool:changed',
  TOOL_ACTIVATED: 'tool:activated',
  TOOL_DEACTIVATED: 'tool:deactivated',

  // 지도 관련
  MAP_MOVEEND: 'map:moveend',
  MAP_CLICK: 'map:click',
  MAP_POINTER_MOVE: 'map:pointermove',

  // 프로젝트 관련
  PROJECT_SAVED: 'project:saved',
  PROJECT_LOADED: 'project:loaded',
  PROJECT_NEW: 'project:new',

  // CRS 관련
  CRS_CHANGED: 'crs:changed',

  // 측정 관련
  MEASUREMENT_CLEAR: 'measurement:clear',

  // 테이블 조인 관련
  TABLE_JOINED: 'table:joined'
};
