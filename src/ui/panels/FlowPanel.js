// © 2026 김용현
/**
 * FlowPanel — 주제도 → 흐름도.
 *  1. 데이터: 실습 데이터(흐름) 또는 파일. 형식(긴/행렬) 자동 판별, 긴 형식은 열 지정
 *  2. 위치: 기준 레이어 + 이름/코드 열, 또는 위치 표 파일
 *  3. 매칭 결과: 위치·흐름 수, 못 맞춘 이름 → 손 매칭
 *  4. 스타일
 * 상태는 이 인스턴스가 들고, 계산은 flowModel 에 맡긴다.
 */
import { flowTool, FLOW_ANIMATE_LIMIT } from '../../tools/FlowTool.js';
import { layerManager } from '../../core/LayerManager.js';
import { mapManager } from '../../core/MapManager.js';
import { builtinDataManager } from '../../core/BuiltinDataManager.js';
import { readFlowFile, locationsFromTable } from '../../loaders/FlowLoader.js';
import { listCandidateLayers, layerFieldNames, guessNameField, layerLocations } from '../../flow/layerLocations.js';
import {
  guessColumns, detectTableShape, parseLongTable, parseMatrixTable, buildDataset, drawableFlowCount, COLOR_RAMPS
} from '../../flow/flowModel.js';
import { DEFAULT_FLOW_STYLE } from '../../flow/FlowRenderer.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

const RAMP_LABELS = { teal: '청록', blue: '파랑', orange: '주황', purple: '보라' };

class FlowPanel {
  constructor() {
    this.modal = null;
    this._escHandler = null;
    this._reset();
  }

  _reset() {
    this.table = null;          // { headers, data, fileName }
    this.practiceKey = '';      // 고른 실습 데이터 'groupId|id' (다시 그려도 선택이 남도록)
    this.shape = 'auto';        // 'auto' | 'long' | 'matrix'
    this.columns = null;        // { origin, dest, count } (긴 형식)
    this.pairs = [];
    this.skipped = 0;
    this.locationSource = 'layer'; // 'layer' | 'table'
    this.baseLayerId = '';
    this.nameField = '';
    this.codeField = '';
    this.locationTable = null;  // 위치 표 후보
    this.candidates = [];       // 마지막 _rebuild 에서 쓴 위치 후보 (손 매칭 드롭다운·제외 수 표시용)
    this._candidateCache = null; // { key, list } — 기준 레이어·열이 같으면 대표점을 다시 계산하지 않는다
    this.manualMap = {};
    this.dataset = null;
    this.style = { ...DEFAULT_FLOW_STYLE };
    this.editingLayerId = null;
    this._styleBefore = null;   // 편집 모드에서 취소하면 되돌릴 스타일
    this._basemapBefore = null; // 어두운 배경을 켜기 전 배경지도 (끄면 여기로 돌아간다)
    this._basemapAtOpen = null; // 편집 모드를 연 시점의 배경지도 (취소하면 여기로 돌아간다)
    this._basemapToggled = false;
    this.title = '';
  }

  /** 만들기 모드: 지금 배경지도가 어두우면 어두운 램프로 시작한다 (체크박스와 스타일이 어긋나지 않도록) */
  _syncDarkModeToBasemap() {
    this.style.darkMode = mapManager.getBasemap() === 'ESRI_DARK';
  }

  show() {
    this._reset();
    this._syncDarkModeToBasemap();
    this.render();
    // 실습 데이터 카탈로그는 내장 데이터 대화상자를 열어야 읽히므로, 여기서도 미리 읽어 드롭다운을 채운다
    // (한 번 읽은 뒤에는 바로 끝난다)
    builtinDataManager.loadCatalogs()
      .then(() => { if (this.modal && !this.table) this.render(); })
      .catch(() => {});
  }

  /** 실습 데이터 탭에서: 표를 바로 채워 연다. practiceKey('groupId|id')가 오면 드롭다운에도 그 선택을 보여 준다 */
  showWithTable({ headers, data, fileName, dataset, practiceKey = '' }) {
    this._reset();
    this._syncDarkModeToBasemap();
    this.table = { headers, data, fileName: (dataset && dataset.name) || fileName };
    this.practiceKey = practiceKey;
    this.title = this.table.fileName;
    this._parseTable();
    this.render();
  }

  /** 레이어 목록의 스타일 편집에서: 기존 레이어 스타일만 고친다 (취소하면 열기 전 스타일·배경지도로 되돌린다) */
  showForLayer(layerId) {
    const info = layerManager.getLayer(layerId);
    if (!info || !info._flowConfig) return;
    this._reset();
    this.editingLayerId = layerId;
    this.dataset = info._flowConfig.dataset;
    this.style = { ...info._flowConfig.style };
    this._styleBefore = { ...info._flowConfig.style };
    this._basemapAtOpen = mapManager.getBasemap();
    this.title = info.name;
    this.render();
  }

  close() {
    if (this.modal) { this.modal.remove(); this.modal = null; }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  }

  /** 취소·닫기·Esc·바깥 클릭: 편집 중이면 스타일(과 여기서 바꾼 배경지도)을 열기 전으로 되돌리고 닫는다 */
  _cancel() {
    if (this.editingLayerId && this._styleBefore) {
      flowTool.updateStyle(this.editingLayerId, this._styleBefore);
      if (this._basemapToggled && this._basemapAtOpen && mapManager.getBasemap() !== this._basemapAtOpen) {
        mapManager.setBasemap(this._basemapAtOpen);
      }
    }
    this.close();
  }

  // ---- 렌더 --------------------------------------------------------------------

  render() {
    this.close();
    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay flow-modal active';
    this.modal.innerHTML = this._html();
    document.body.appendChild(this.modal);
    this._bind();
  }

  _html() {
    const editing = !!this.editingLayerId;
    return `
      <div class="modal-content flow-content">
        <div class="modal-header">
          <h3>${editing ? '흐름도 스타일' : '흐름도 만들기'}</h3>
          <button class="modal-close" id="flow-close" title="닫기">&times;</button>
        </div>
        <div class="modal-body">
          ${editing ? '' : this._dataSectionHTML() + this._locationSectionHTML()}
          ${this._matchSectionHTML()}
          ${this._styleSectionHTML()}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="flow-cancel">취소</button>
          <button class="btn btn-primary" id="flow-create" ${this._canCreate() ? '' : 'disabled'}>${editing ? '적용' : '흐름 레이어 만들기'}</button>
        </div>
      </div>`;
  }

  _dataSectionHTML() {
    const practice = (builtinDataManager.getPracticeCatalog() || [])
      .flatMap((g) => (g.datasets || []).filter((d) => d.type === 'flow').map((d) => ({ ...d, groupId: g.id })));
    const practiceOptions = practice.map((d) => {
      const key = `${d.groupId}|${d.id}`;
      return `<option value="${escapeHtml(key)}" ${key === this.practiceKey ? 'selected' : ''}>${escapeHtml(d.name)}</option>`;
    }).join('');
    const t = this.table;
    const shape = t ? (this.shape === 'auto' ? detectTableShape(t) : this.shape) : null;
    const colSelect = (id, value) => `<select id="${id}">${t.headers.map((h) => `<option value="${escapeHtml(h)}" ${h === value ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('')}</select>`;
    return `
      <div class="flow-section">
        <div class="flow-section-title">1. 흐름 데이터 <span class="flow-muted">출발 · 도착 · 양</span></div>
        <div class="form-group">
          <label for="flow-practice">실습 데이터</label>
          <select id="flow-practice"><option value="">선택…</option>${practiceOptions}</select>
        </div>
        <div class="form-group">
          <label for="flow-file">또는 파일 (CSV / XLSX)</label>
          <input type="file" id="flow-file" accept=".csv,.txt,.xlsx,.xlsm,.xls">
        </div>
        ${t ? `
          <div class="flow-loaded">불러온 표: ${escapeHtml(t.fileName)} — ${t.data.length}행 × ${t.headers.length}열</div>
          <div class="form-group">
            <label for="flow-shape">표 형식</label>
            <select id="flow-shape">
              <option value="auto" ${this.shape === 'auto' ? 'selected' : ''}>자동 (${shape === 'matrix' ? '행렬형' : '긴 형식'}으로 판별)</option>
              <option value="long" ${this.shape === 'long' ? 'selected' : ''}>긴 형식 (출발·도착·양 세 열)</option>
              <option value="matrix" ${this.shape === 'matrix' ? 'selected' : ''}>행렬형 (행=전출지, 열=전입지)</option>
            </select>
          </div>
          ${shape === 'long' ? `
            <div class="flow-cols">
              <div class="form-group"><label for="flow-col-origin">출발</label>${colSelect('flow-col-origin', this.columns.origin)}</div>
              <div class="form-group"><label for="flow-col-dest">도착</label>${colSelect('flow-col-dest', this.columns.dest)}</div>
              <div class="form-group"><label for="flow-col-count">양</label>${colSelect('flow-col-count', this.columns.count)}</div>
            </div>` : ''}
          <div class="flow-muted">흐름 ${this.pairs.length}개${this.skipped ? ` · 건너뛴 행 ${this.skipped}` : ''}</div>
        ` : ''}
      </div>`;
  }

  _locationSectionHTML() {
    const layers = listCandidateLayers();
    const layerOptions = layers.map((l) => `<option value="${escapeHtml(l.id)}" ${l.id === this.baseLayerId ? 'selected' : ''}>${escapeHtml(l.name)} (${l.source.getFeatures().length})</option>`).join('');
    const base = this.baseLayerId ? layerManager.getLayer(this.baseLayerId) : null;
    const fields = base ? layerFieldNames(base) : [];
    const fieldOptions = (value, allowNone) => (allowNone ? '<option value="">(없음)</option>' : '') +
      fields.map((f) => `<option value="${escapeHtml(f)}" ${f === value ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('');
    // 이름 열이 비었거나 도형이 없는 피처는 layerLocations 가 조용히 빼므로, 몇 개가 빠졌는지 알려 준다
    const excluded = (base && this.nameField && this.locationSource === 'layer')
      ? base.source.getFeatures().length - this.candidates.length : 0;
    return `
      <div class="flow-section">
        <div class="flow-section-title">2. 위치 <span class="flow-muted">출발·도착 이름을 어디에 맞출지</span></div>
        <div class="flow-radio">
          <label><input type="radio" name="flow-locsrc" value="layer" ${this.locationSource === 'layer' ? 'checked' : ''}> 지도의 레이어 (행정경계 등)</label>
          <label><input type="radio" name="flow-locsrc" value="table" ${this.locationSource === 'table' ? 'checked' : ''}> 위치 표 파일 (id · 이름 · 위도 · 경도)</label>
        </div>
        ${this.locationSource === 'layer' ? `
          <div class="form-group">
            <label for="flow-base-layer">기준 레이어</label>
            <select id="flow-base-layer"><option value="">선택…</option>${layerOptions}</select>
            ${layers.length === 0 ? '<div class="flow-muted">먼저 데이터 불러오기에서 행정경계(Area Data)를 추가하세요.</div>' : ''}
          </div>
          ${base ? `
            <div class="flow-cols">
              <div class="form-group"><label for="flow-name-field">이름 열</label><select id="flow-name-field">${fieldOptions(this.nameField, false)}</select></div>
              <div class="form-group"><label for="flow-code-field">코드 열</label><select id="flow-code-field">${fieldOptions(this.codeField, true)}</select></div>
            </div>
            ${excluded > 0 ? `<div class="flow-muted">이름·좌표 없는 피처 ${excluded}개 제외</div>` : ''}` : ''}
        ` : `
          <div class="form-group">
            <label for="flow-loc-file">위치 표</label>
            <input type="file" id="flow-loc-file" accept=".csv,.txt,.xlsx,.xlsm,.xls">
            ${this.locationTable ? `<div class="flow-loaded">위치 ${this.locationTable.length}개</div>` : ''}
          </div>
        `}
      </div>`;
  }

  _matchSectionHTML() {
    const ds = this.dataset;
    const editing = !!this.editingLayerId;
    if (!ds) return editing ? '' : '<div class="flow-section flow-muted">데이터와 위치를 고르면 매칭 결과가 여기에 나옵니다.</div>';
    const unmatched = ds.meta.unmatched || [];
    const options = this.candidates.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    const drawable = drawableFlowCount(ds);
    const selfCount = ds.flows.length - drawable;
    const shown = unmatched.slice(0, 30);
    // 스타일 편집 모드에는 원본 흐름 쌍이 없어 다시 매칭할 수 없다 — 이름만 보여 준다
    const unmatchedRows = shown.map((u) => `
      <div class="flow-unmatched-row">
        <span title="${escapeHtml(String(u.count))}">${escapeHtml(u.name)} <span class="flow-muted">${Number(u.count).toLocaleString('ko-KR')}</span></span>
        ${editing ? '' : `<select data-manual="${escapeHtml(u.name)}" aria-label="${escapeHtml(u.name)} 짝짓기"><option value="">(제외)</option>${options}</select>`}
      </div>`).join('');
    return `
      <div class="flow-section">
        <div class="flow-section-title">3. 매칭 결과</div>
        <div>위치 <b>${ds.locations.length}</b>개 · 흐름 <b>${drawable}</b>개${selfCount ? ` (자기 흐름 ${selfCount}개 별도)` : ''}${ds.meta.skipped ? ` · 건너뛴 행 ${ds.meta.skipped}` : ''}</div>
        ${ds.locations.length < 2 || drawable === 0 ? '<div class="flow-warn">흐름을 그릴 수 없습니다 — 위치가 2개 이상, 흐름이 1개 이상 필요합니다.</div>' : ''}
        ${unmatched.length ? `
          <div class="flow-warn">매칭 안 됨 ${unmatched.length}건${editing ? '' : ' — 아래에서 손으로 짝지을 수 있습니다'}</div>
          <div class="flow-unmatched">
            ${unmatchedRows}
            ${unmatched.length > 30 ? `<div class="flow-muted">… 외 ${unmatched.length - 30}건</div>` : ''}
          </div>` : ''}
        ${editing ? '' : `<div class="form-group"><label for="flow-title">레이어 이름</label><input type="text" id="flow-title" value="${escapeHtml(this.title)}"></div>`}
      </div>`;
  }

  /** 만들기 모드에서 흐름이 너무 많으면 애니메이션을 끈 채 만든다 (FlowTool 의 한도와 같은 기준) */
  _tooManyToAnimate() {
    return !this.editingLayerId && !!this.dataset && this.dataset.flows.length > FLOW_ANIMATE_LIMIT;
  }

  _styleSectionHTML() {
    const s = this.style;
    const tooMany = this._tooManyToAnimate();
    return `
      <div class="flow-section">
        <div class="flow-section-title">4. 스타일</div>
        <div class="flow-cols">
          <div class="form-group"><label for="flow-ramp">색상</label>
            <select id="flow-ramp">${Object.keys(COLOR_RAMPS).map((k) => `<option value="${k}" ${k === s.ramp ? 'selected' : ''}>${RAMP_LABELS[k] || k}</option>`).join('')}</select></div>
          <div class="form-group"><label for="flow-width">굵기 <span id="flow-width-val">${s.widthScale.toFixed(1)}</span>×</label>
            <input type="range" id="flow-width" min="0.3" max="2.5" step="0.1" value="${s.widthScale}"></div>
          <div class="form-group"><label for="flow-opacity">투명도 <span id="flow-opacity-val">${Math.round(s.opacity * 100)}</span>%</label>
            <input type="range" id="flow-opacity" min="10" max="100" step="5" value="${Math.round(s.opacity * 100)}"></div>
        </div>
        <div class="flow-checks">
          <label><input type="checkbox" id="flow-animate" ${s.animate && !tooMany ? 'checked' : ''} ${tooMany ? 'disabled' : ''}> 애니메이션</label>
          <label>속도 <input type="range" id="flow-speed" min="0.3" max="3" step="0.1" value="${s.animSpeed}" style="width:80px"></label>
          <label><input type="checkbox" id="flow-locs" ${s.showLocations ? 'checked' : ''}> 위치 원</label>
          <label><input type="checkbox" id="flow-labels" ${s.showLabels ? 'checked' : ''}> 라벨</label>
          <label><input type="checkbox" id="flow-curved" ${s.curved ? 'checked' : ''}> 곡선으로 그리기</label>
          <label><input type="checkbox" id="flow-self" ${s.includeSelf ? 'checked' : ''}> 자기 흐름을 집계에 포함</label>
          <label>상위 <input type="number" id="flow-topn" min="0" value="${s.topN}" style="width:60px"> 개만 (0 = 전부)</label>
          <label><input type="checkbox" id="flow-dark" ${s.darkMode ? 'checked' : ''}> 어두운 배경지도</label>
        </div>
        ${tooMany ? `<div class="flow-muted">흐름이 ${FLOW_ANIMATE_LIMIT.toLocaleString('ko-KR')}개를 넘어 애니메이션은 꺼진 채 시작합니다 (스타일에서 켜면 돕니다)</div>` : ''}
      </div>`;
  }

  // ---- 이벤트 ------------------------------------------------------------------

  _bind() {
    const $ = (id) => this.modal.querySelector('#' + id);
    $('flow-close').addEventListener('click', () => this._cancel());
    $('flow-cancel').addEventListener('click', () => this._cancel());
    $('flow-create').addEventListener('click', () => this._create());

    // 바깥(오버레이) 클릭 — 슬라이더를 끌다 바깥에서 놓은 경우는 닫지 않도록 누른 곳도 확인한다
    let downOnOverlay = false;
    this.modal.addEventListener('pointerdown', (e) => { downOnOverlay = e.target === this.modal; });
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal && downOnOverlay) this._cancel();
      downOnOverlay = false;
    });
    // Esc
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    this._escHandler = (e) => { if (e.key === 'Escape') this._cancel(); };
    document.addEventListener('keydown', this._escHandler);

    // 1. 데이터
    const practice = $('flow-practice');
    if (practice) practice.addEventListener('change', async (e) => {
      if (!e.target.value) return;
      const [groupId, id] = e.target.value.split('|');
      try {
        const r = await builtinDataManager.loadPracticeDataset(groupId, id);
        this.practiceKey = e.target.value;
        this.table = { headers: r.headers, data: r.data, fileName: (r.dataset && r.dataset.name) || r.fileName };
        this.title = this.table.fileName;
        this.shape = 'auto';
        this.columns = null;
        this._parseTable();
        this._rebuild();
      } catch (err) { alert(err.message); }
    });
    const file = $('flow-file');
    if (file) file.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        this.table = await readFlowFile(f);
        this.practiceKey = '';
        this.title = this.table.fileName;
        this.shape = 'auto';
        this.columns = null;
        this._parseTable();
        this._rebuild();
      } catch (err) { alert(err.message); }
    });
    const shape = $('flow-shape');
    if (shape) shape.addEventListener('change', (e) => { this.shape = e.target.value; this._parseTable(); this._rebuild(); });
    for (const key of ['origin', 'dest', 'count']) {
      const el = $('flow-col-' + key);
      if (el) el.addEventListener('change', (e) => { this.columns[key] = e.target.value; this._parseTable(); this._rebuild(); });
    }

    // 2. 위치
    this.modal.querySelectorAll('input[name="flow-locsrc"]').forEach((r) => r.addEventListener('change', (e) => {
      this.locationSource = e.target.value; this.manualMap = {}; this._rebuild();
    }));
    const base = $('flow-base-layer');
    if (base) base.addEventListener('change', (e) => {
      this.baseLayerId = e.target.value;
      const info = this.baseLayerId ? layerManager.getLayer(this.baseLayerId) : null;
      const fields = info ? layerFieldNames(info) : [];
      this.nameField = guessNameField(fields) || '';
      this.codeField = fields.find((f) => /^(code|코드|지역코드)$/i.test(f)) || '';
      this.manualMap = {};
      this._rebuild();
    });
    const nameField = $('flow-name-field');
    if (nameField) nameField.addEventListener('change', (e) => { this.nameField = e.target.value; this.manualMap = {}; this._rebuild(); });
    const codeField = $('flow-code-field');
    if (codeField) codeField.addEventListener('change', (e) => { this.codeField = e.target.value; this.manualMap = {}; this._rebuild(); });
    const locFile = $('flow-loc-file');
    if (locFile) locFile.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { this.locationTable = locationsFromTable(await readFlowFile(f)); this.manualMap = {}; this._rebuild(); }
      catch (err) { alert(err.message); }
    });

    // 3. 손 매칭
    this.modal.querySelectorAll('select[data-manual]').forEach((sel) => sel.addEventListener('change', (e) => {
      const raw = e.target.dataset.manual;
      if (e.target.value) this.manualMap[raw] = e.target.value; else delete this.manualMap[raw];
      this._rebuild();
    }));
    const title = $('flow-title');
    if (title) title.addEventListener('input', (e) => { this.title = e.target.value; });

    // 4. 스타일 — 편집 중이면 즉시 반영
    const live = (patch) => {
      this.style = { ...this.style, ...patch };
      if (this.editingLayerId) flowTool.updateStyle(this.editingLayerId, patch);
    };
    $('flow-ramp').addEventListener('change', (e) => live({ ramp: e.target.value }));
    $('flow-width').addEventListener('input', (e) => { $('flow-width-val').textContent = Number(e.target.value).toFixed(1); live({ widthScale: Number(e.target.value) }); });
    $('flow-opacity').addEventListener('input', (e) => { $('flow-opacity-val').textContent = e.target.value; live({ opacity: Number(e.target.value) / 100 }); });
    $('flow-animate').addEventListener('change', (e) => live({ animate: e.target.checked }));
    $('flow-speed').addEventListener('input', (e) => live({ animSpeed: Number(e.target.value) }));
    $('flow-locs').addEventListener('change', (e) => live({ showLocations: e.target.checked }));
    $('flow-labels').addEventListener('change', (e) => live({ showLabels: e.target.checked }));
    $('flow-curved').addEventListener('change', (e) => live({ curved: e.target.checked }));
    $('flow-self').addEventListener('change', (e) => live({ includeSelf: e.target.checked }));
    $('flow-topn').addEventListener('change', (e) => live({ topN: Math.max(0, Number(e.target.value) || 0) }));
    // CARTO 타일은 API 키 없이는 워터마크가 찍히므로 어두운 배경은 Esri 다크 그레이(ESRI_DARK)를 쓴다.
    // 끄면 켜기 전에 쓰던 배경지도로 돌아간다.
    $('flow-dark').addEventListener('change', (e) => {
      this._basemapToggled = true;
      if (e.target.checked) {
        const current = mapManager.getBasemap();
        if (current !== 'ESRI_DARK') this._basemapBefore = current;
        mapManager.setBasemap('ESRI_DARK');
      } else {
        mapManager.setBasemap(this._basemapBefore && this._basemapBefore !== 'ESRI_DARK' ? this._basemapBefore : 'OSM');
      }
      // 램프도 배경에 맞춰 뒤집는다 (어두운 배경 = 큰 흐름이 밝게)
      live({ darkMode: e.target.checked });
    });
  }

  // ---- 계산 --------------------------------------------------------------------

  _parseTable() {
    const t = this.table;
    if (!t) { this.pairs = []; this.skipped = 0; return; }
    const shape = this.shape === 'auto' ? detectTableShape(t) : this.shape;
    if (shape === 'matrix') {
      const r = parseMatrixTable(t);
      this.pairs = r.pairs; this.skipped = r.skipped;
    } else {
      if (!this.columns) this.columns = guessColumns(t.headers);
      const r = parseLongTable(t, this.columns);
      this.pairs = r.pairs; this.skipped = r.skipped;
    }
  }

  _candidates() {
    if (this.locationSource === 'table') return this.locationTable || [];
    const info = this.baseLayerId ? layerManager.getLayer(this.baseLayerId) : null;
    if (!info || !this.nameField) return [];
    // 대표점 계산은 피처마다 turf 를 돌려 시군구·읍면동 레이어에서 무겁다 — 손 매칭·열 변경으로
    // _rebuild 가 거듭 불려도 기준 레이어·이름 열·코드 열이 같으면 지난 결과를 그대로 쓴다
    const key = JSON.stringify([this.baseLayerId, this.nameField, this.codeField]);
    if (!this._candidateCache || this._candidateCache.key !== key) {
      this._candidateCache = { key, list: layerLocations(info, this.nameField, this.codeField || null) };
    }
    return this._candidateCache.list;
  }

  /** 상태에서 데이터셋을 다시 만들고 화면을 다시 그린다 */
  _rebuild() {
    this.candidates = this._candidates();
    this.dataset = (this.pairs.length && this.candidates.length)
      ? buildDataset({
          pairs: this.pairs, candidates: this.candidates, manualMap: this.manualMap,
          meta: { title: this.title, unit: '명', source: this.table ? this.table.fileName : '', skipped: this.skipped }
        })
      : null;
    this.render();
  }

  _canCreate() {
    if (this.editingLayerId) return true;
    const ds = this.dataset;
    if (!ds) return false;
    return ds.locations.length >= 2 && drawableFlowCount(ds) > 0;
  }

  _create() {
    if (this.editingLayerId) { this.close(); return; }
    if (!this._canCreate()) return;
    const name = (this.title || '흐름도').trim() || '흐름도';
    this.dataset.meta.title = name;
    // 흐름이 FLOW_ANIMATE_LIMIT 을 넘으면 createFlowLayer 가 애니메이션을 끈다 — 여기서 겹쳐 끄지 않는다
    flowTool.createFlowLayer({ name, dataset: this.dataset, style: { ...this.style } });
    this.close();
  }
}

export const flowPanel = new FlowPanel();
