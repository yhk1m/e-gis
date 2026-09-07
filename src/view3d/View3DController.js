// © 2026 김용현
/**
 * 3D 보기 조립부 — e-GIS(지도·레이어)와 three 씬을 잇는 유일한 곳.
 *
 * 불변식: 텍스처와 메시는 언제나 함께 갱신한다. 하나만 바꾸면 지형 무늬가 미끄러진다.
 */

import { toLonLat } from 'ol/proj';
import { buildTerrainGeometry, MAX_GRID } from './terrainMesh.js';
import { composeMapCanvas } from './mapTexture.js';
import { sceneToMap, rebaseOffset, resolutionForDistance } from './view3dMath.js';
import { Scene3D, FOV } from './Scene3D.js';

/** 카메라가 멈춘 뒤 이만큼 지나면 갱신한다 */
const SETTLE_MS = 150;

/** 조작 중 강제 갱신 사이의 최소 간격 */
const DRAG_REFRESH_MS = 300;

/** 타깃이 화면 크기의 이만큼을 넘게 이동하면 조작 중에도 갱신한다 */
const DRIFT_RATIO = 0.25;

export class View3DController {
  /**
   * @param {Object} deps { mapManager, layerManager, container }
   *   container는 캔버스를 얹을 요소(#map-container)
   */
  constructor({ mapManager, layerManager, container }) {
    this.mapManager = mapManager;
    this.layerManager = layerManager;
    this.container = container;

    this.scene = null;
    this.exaggeration = 2;
    this.center = [0, 0];     // 지금 메시의 원점(3857)
    this.settleTimer = null;
    this.active = false;
    this.syncing = false;     // 우리가 뷰를 바꿔 생긴 변화에 다시 반응하지 않게 한다
    this.span = 0;            // 지금 메시가 덮는 크기(미터) — 이동량 판단에 쓴다
    this.lastRefreshAt = 0;
  }

  /** 보이는 DEM 레이어의 demData — 없으면 null */
  findDemData() {
    let found = null;
    for (const layerInfo of this.layerManager.layers.values()) {
      if (layerInfo.demData && layerInfo.olLayer?.getVisible()) found = layerInfo.demData;
    }
    return found;
  }

  /** 3D를 켠다 */
  enter() {
    if (this.active) return;
    this.scene = new Scene3D(this.container);
    this.scene.onCameraChange = () => this.scheduleRefresh();
    this.active = true;

    this.refresh({ frame: true });
    this.scene.start();

    this.resizeHandler = () => this.scene?.resize();
    window.addEventListener('resize', this.resizeHandler);
  }

  /** 3D를 끈다 */
  exit() {
    if (!this.active) return;
    clearTimeout(this.settleTimer);
    window.removeEventListener('resize', this.resizeHandler);
    this.scene.dispose();
    this.scene = null;
    this.active = false;
  }

  /** 세로 과장을 바꾼다 — 메시를 다시 만든다 */
  setExaggeration(value) {
    this.exaggeration = value;
    if (this.active) this.refresh({ frame: false });
  }

  /**
   * 카메라가 멈추면 갱신하도록 예약한다.
   *
   * 멀리 끄는 동안에는 멈추기를 기다리면 메시 밖으로 나가 버린다.
   * 그래서 타깃이 화면 크기의 25%를 넘게 벗어나면 조작 중에도 갱신한다.
   * (갱신 직후 타깃은 원점으로 돌아오므로, 타깃까지의 거리가 곧 이동량이다)
   */
  scheduleRefresh() {
    if (!this.active || this.syncing) return;

    const target = this.scene.controls.target;
    const drift = Math.hypot(target.x, target.z);
    const now = Date.now();
    if (drift > this.span * DRIFT_RATIO && now - this.lastRefreshAt > DRAG_REFRESH_MS) {
      clearTimeout(this.settleTimer);
      this.syncAndRefresh();
      return;
    }

    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.syncAndRefresh(), SETTLE_MS);
  }

  /** 카메라 위치를 2D 지도에 반영한 뒤 갱신한다 (연동) */
  syncAndRefresh() {
    if (!this.active) return;
    const map = this.mapManager.getMap();
    const view = map.getView();
    const size = map.getSize();
    if (!size) return;

    this.syncing = true;
    try {
      const target = this.scene.controls.target;
      view.setCenter(sceneToMap(target, this.center));

      const distance = this.scene.camera.position.distanceTo(target);
      view.setResolution(resolutionForDistance(distance, FOV, size[1]));

      this.refresh({ frame: false });
    } finally {
      this.syncing = false;
    }
  }

  /**
   * 텍스처와 메시를 함께 다시 만든다.
   * @param {{frame: boolean}} options frame이면 카메라를 처음 위치로 잡는다
   */
  refresh({ frame }) {
    const map = this.mapManager.getMap();
    const view = map.getView();
    const size = map.getSize();
    if (!size) return;

    map.renderSync();
    const textureCanvas = composeMapCanvas(map.getTargetElement(), { size });
    if (!textureCanvas) return;

    const extent = view.calculateExtent(size);
    const latitude = toLonLat(view.getCenter())[1];
    const demData = this.findDemData();

    const geometry = demData
      ? buildTerrainGeometry({
          demData,
          extent,
          maxGrid: MAX_GRID,
          exaggeration: this.exaggeration,
          latitude
        })
      : flatGeometry(extent);

    const previousCenter = this.center;
    this.center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
    this.span = Math.max(extent[2] - extent[0], extent[3] - extent[1]);
    this.lastRefreshAt = Date.now();

    this.scene.setTerrain(geometry, textureCanvas);

    if (frame) {
      this.scene.frameExtent(extent[2] - extent[0], extent[3] - extent[1]);
    } else {
      const { dx, dz } = rebaseOffset(previousCenter, this.center);
      this.scene.shift(dx, dz);
    }
  }

  /** 3D 화면을 PNG 데이터 URL로 돌려준다 */
  toDataURL() {
    if (!this.active) return null;
    this.scene.renderer.render(this.scene.scene, this.scene.camera);
    return this.scene.renderer.domElement.toDataURL('image/png');
  }
}

/** DEM이 없을 때 쓰는 평평한 바닥 — 주제도만 볼 때 */
function flatGeometry(extent) {
  const [minX, minY, maxX, maxY] = extent;
  const halfW = (maxX - minX) / 2;
  const halfH = (maxY - minY) / 2;
  return {
    positions: Float32Array.from([
      -halfW, 0, -halfH, halfW, 0, -halfH,
      -halfW, 0, halfH, halfW, 0, halfH
    ]),
    uvs: Float32Array.from([0, 1, 1, 1, 0, 0, 1, 0]),
    indices: Uint32Array.from([0, 2, 1, 1, 2, 3]),
    gridWidth: 2,
    gridHeight: 2,
    holes: 0
  };
}
