// © 2026 김용현
/**
 * 3D 보기 조립부 — e-GIS(지도·레이어)와 three 씬을 잇는 유일한 곳.
 *
 * 불변식: 텍스처와 메시는 언제나 함께 갱신한다. 하나만 바꾸면 지형 무늬가 미끄러진다.
 */

import { toLonLat } from 'ol/proj';
import { eventBus, Events } from '../utils/EventBus.js';
import { pickDemLayers, listDemLayers, ALL } from './terrainSource.js';
import { buildTerrainGeometry } from './terrainMesh.js';
import { composeMapCanvas, hasVisibleContent } from './mapTexture.js';
import {
  sceneToMap, rebaseOffset, resolutionForDistance, combinedExtentCenter
} from './view3dMath.js';
import { Scene3D, FOV } from './Scene3D.js';
import { currentQuality } from './quality.js';

/** 카메라가 멈춘 뒤 이만큼 지나면 갱신한다 */
const SETTLE_MS = 150;

/** 조작 중 강제 갱신 사이의 최소 간격 */
const DRAG_REFRESH_MS = 300;

/** 타깃이 화면 크기의 이만큼을 넘게 이동하면 조작 중에도 갱신한다 */
const DRIFT_RATIO = 0.25;

/**
 * 지형을 화면 범위보다 이만큼 넓게 만든다.
 *
 * 45°로 기운 카메라가 보는 땅은 시선 방향으로 화면 범위의 약 0.87배까지 뻗는데,
 * 메시는 그 방향으로 (화면 세로 ÷ 2 × 배율)만큼만 있다. 배율 2로는 0.66배라 모자라
 * far 쪽이 잘린다. 3이면 0.99배가 되어 기본 시야를 덮는다.
 *
 * 지평선 가까이 눕히면 어떤 배율로도 못 덮으므로, 가장자리는 안개로 풀어
 * 잘린 선이 드러나지 않게 한다(Scene3D.setFog).
 *
 * 텍스처도 같은 범위로 함께 넓혀 굽는다 — 넓힐수록 표면은 그만큼 무뎌진다.
 */
const SURFACE_PAD = 3;

/** 빈 그림이 나올 때 다시 시도할 최대 횟수 — 무한히 붙들지 않는다 */
const MAX_EMPTY_RETRIES = 12;

/** 2D에서 레이어가 바뀐 뒤 표면을 다시 굽기까지 기다리는 시간 */
const LAYER_SETTLE_MS = 120;

/** 표면을 다시 구워야 하는 2D 쪽 변화들 */
const SURFACE_EVENTS = [
  Events.LAYER_ADDED,
  Events.LAYER_REMOVED,
  Events.LAYER_VISIBILITY_CHANGED,
  Events.LAYER_ORDER_CHANGED,
  Events.LAYER_STYLE_CHANGED
];

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
    this.terrainLayerId = ALL;    // ALL이면 불러온 DEM을 모두 잇는다. FLAT이면 평면
    this.quality = currentQuality();   // 태블릿·휴대폰에서는 격자와 텍스처를 낮춘다
    this.emptyRetries = 0;             // 타일이 안 와 빈 그림이 나온 횟수
    this.layerTimer = null;
    this.onLayersChanged = null;  // 지형 목록을 다시 채우라고 패널에 알린다
    this.onCameraMoved = null;    // 방위표시를 돌리라고 패널에 알린다
  }

  /** 지형으로 쓸 수 있는 DEM 목록 (가시성과 무관) */
  listTerrainSources() {
    return listDemLayers(this.layerManager.layers);
  }

  /** 지형 원본을 바꾼다 — FLAT이면 평면 */
  setTerrainSource(layerId) {
    this.terrainLayerId = layerId;
    if (this.active) this.refresh({ frame: false });
  }

  /** 지금 올라와 있는 레이어들의 가운데 — 고정점 기본 위치 */
  visibleLayersCenter() {
    const extents = [];
    for (const layerInfo of this.layerManager.layers.values()) {
      if (!layerInfo.olLayer?.getVisible?.()) continue;
      if (layerInfo.demData) {
        extents.push(layerInfo.demData.extent);
        continue;
      }

      const extent = layerInfo.olLayer.getSource?.()?.getExtent?.();
      if (extent) extents.push(extent);
    }
    return combinedExtentCenter(extents);
  }

  /**
   * 고도를 가져올 DEM 목록 — 비어 있으면 평면.
   *
   * 기본은 **불러온 DEM 전부**다. 시군구처럼 나뉜 DEM을 여러 장 불러오면
   * 하나의 지형으로 이어 붙는다. 겹치는 곳은 위 레이어가 이긴다.
   *
   * **레이어의 2D 가시성은 보지 않는다.** 고도 원본과 표면은 별개이기 때문이다.
   * DEM 레이어를 레이어 패널에서 끄면 지형은 그대로 서 있고 표면만 그 아래로 바뀐다.
   */
  findDems() {
    return pickDemLayers(this.layerManager.layers, this.terrainLayerId).map((e) => e.demData);
  }

  /** 3D를 켠다 */
  enter() {
    if (this.active) return;
    // 고정점(회전 중심)을 레이어 가운데에 둔다. OrbitControls의 타깃은 늘 화면 한가운데라
    // 지도 중심을 옮기는 것이 곧 고정점을 옮기는 것이다.
    const layersCenter = this.visibleLayersCenter();
    if (layersCenter) this.mapManager.getMap().getView().setCenter(layersCenter);

    this.quality = currentQuality();
    this.scene = new Scene3D(this.container, { pixelRatio: this.quality.pixelRatio });
    this.scene.onCameraChange = () => {
      this.scheduleRefresh();
      if (this.onCameraMoved) this.onCameraMoved(this.scene.getBearing());
    };
    this.scene.onPivotMoved = () => this.scheduleRefresh();
    this.active = true;

    this.refresh({ frame: true });
    if (this.onCameraMoved) this.onCameraMoved(this.scene.getBearing());
    this.scene.start();

    this.resizeHandler = () => this.scene?.resize();
    window.addEventListener('resize', this.resizeHandler);

    // 2D에서 레이어를 켜고 끄면 지형 표면도 곧바로 따라야 한다.
    // 이게 없으면 레이어를 토글해도 카메라를 움직이기 전까지 3D가 그대로다.
    this.surfaceHandler = () => this.scheduleSurfaceRefresh();
    SURFACE_EVENTS.forEach((name) => eventBus.on(name, this.surfaceHandler));
  }

  /** 표면만 다시 굽는다 — 레이어 변화가 잦아 살짝 모아서 처리한다 */
  scheduleSurfaceRefresh() {
    if (!this.active) return;
    clearTimeout(this.layerTimer);
    this.layerTimer = setTimeout(() => {
      if (!this.active) return;
      this.refresh({ frame: false });
      // 지형으로 쓸 수 있는 DEM 목록도 달라졌을 수 있다
      if (this.onLayersChanged) this.onLayersChanged();
    }, LAYER_SETTLE_MS);
  }

  /**
   * 배경지도를 바꾼다 — 3D 중에는 지도 위 드롭다운이 가려져 여기서 고른다.
   *
   * 바꾼 직후에는 새 타일이 아직 안 왔다. 그 상태로 표면을 구우면 빈 그림이
   * 입혀져 지형이 검게 보이고, 카메라를 움직이기 전까지 그대로 남는다.
   * 그래서 타일이 다 들어온 뒤(rendercomplete) 한 번 더 굽는다.
   * 일회성 구독이라 우리가 굽는 렌더가 다시 굽기를 부르는 되먹임은 없다.
   */
  setBasemap(key) {
    this.mapManager.setBasemap(key);
    if (!this.active) return;

    this.scheduleSurfaceRefresh();
    this.mapManager.getMap().once('rendercomplete', () => {
      if (this.active) this.scheduleSurfaceRefresh();
    });
  }

  /** 3D를 끈다 */
  exit() {
    if (!this.active) return;
    clearTimeout(this.settleTimer);
    clearTimeout(this.layerTimer);
    SURFACE_EVENTS.forEach((name) => eventBus.off(name, this.surfaceHandler));
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

    // 축척바가 계단처럼 뛰지 않도록 뷰는 즉시 맞춘다.
    // OpenLayers는 프레임 단위로 그리므로 한 프레임에 여러 번 불러도 한 번만 그린다.
    this.syncView();

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

  /**
   * 카메라 위치를 2D 지도 뷰에 반영한다. **가볍다** — 중심과 해상도만 옮긴다.
   *
   * 축척바는 2D 뷰의 해상도를 읽으므로, 이걸 카메라가 움직일 때마다 해 줘야
   * 막대가 실시간으로 늘고 준다. 갱신(텍스처·메시)까지 같이 하면 무거워서
   * 조작이 끊기므로 여기서는 하지 않는다.
   */
  syncView() {
    if (!this.active) return false;
    const map = this.mapManager.getMap();
    const view = map.getView();
    const size = map.getSize();
    if (!size) return false;

    const target = this.scene.controls.target;
    view.setCenter(sceneToMap(target, this.center));

    const distance = this.scene.camera.position.distanceTo(target);
    view.setResolution(resolutionForDistance(distance, FOV, size[1]));
    return true;
  }

  /** 카메라 위치를 2D 지도에 반영한 뒤 갱신한다 (연동) */
  syncAndRefresh() {
    if (!this.active) return;

    this.syncing = true;
    try {
      if (!this.syncView()) return;
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

    const viewExtent = view.calculateExtent(size);

    // 표면은 2D 화면에 보이는 그대로다 — 무엇을 보일지는 레이어 패널이 정한다.
    // 다만 화면 사각형보다 넓게 굽는다. 잠시 축척을 낮춰 넓은 화면을 받아 온 뒤 되돌린다.
    // 실제로 적용된 범위를 다시 읽는 이유: 최소 축척에 걸리면 요청한 만큼 안 넓어진다.
    const baseResolution = view.getResolution();
    let extent;
    let textureCanvas;
    try {
      view.setResolution(baseResolution * SURFACE_PAD);
      map.renderSync();
      extent = view.calculateExtent(size);
      textureCanvas = composeMapCanvas(map.getTargetElement(), {
        size,
        pixelRatio: this.quality.pixelRatio,
        maxSize: this.quality.maxTexture
      });
    } finally {
      view.setResolution(baseResolution);
      map.renderSync();
    }
    if (!textureCanvas) return;

    // 타일이 아직 안 온 순간에는 합성 결과가 거의 비어 있다. 그대로 입히면
    // 지형이 검게 보이고 카메라를 움직이기 전까지 그대로 남는다.
    // 이미 입혀 둔 그림이 있으면 그것을 지키고, 조금 뒤 다시 시도한다.
    if (this.scene.terrain && !hasVisibleContent(textureCanvas)) {
      if (this.emptyRetries < MAX_EMPTY_RETRIES) {
        this.emptyRetries++;
        this.scheduleSurfaceRefresh();
        return;
      }
      // 계속 비어 있으면 더 붙들지 않는다 — 배경지도를 '없음'으로 둔 경우도 있다
    }
    this.emptyRetries = 0;

    const latitude = toLonLat(view.getCenter())[1];
    const dems = this.findDems();

    const geometry = dems.length
      ? buildTerrainGeometry({
          dems,
          extent,
          maxGrid: this.quality.maxGrid,
          exaggeration: this.exaggeration,
          latitude
        })
      : flatGeometry(extent);

    const previousCenter = this.center;
    this.center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
    this.span = Math.max(extent[2] - extent[0], extent[3] - extent[1]);
    this.lastRefreshAt = Date.now();

    this.scene.setTerrain(geometry, textureCanvas);
    this.scene.setFog(this.span);

    if (frame) {
      this.scene.frameExtent(viewExtent[2] - viewExtent[0], viewExtent[3] - viewExtent[1]);
    } else {
      const { dx, dz } = rebaseOffset(previousCenter, this.center);
      this.scene.shift(dx, dz);
    }
  }

  /** 3D 화면을 PNG 데이터 URL로 돌려준다 */
  toDataURL() {
    const canvas = this.renderFrame();
    return canvas ? canvas.toDataURL('image/png') : null;
  }

  /**
   * 한 프레임을 그려 캔버스를 그대로 돌려준다.
   *
   * 저장할 때 방위·축척·범례를 이 위에 합성해야 해서 데이터 URL이 아니라
   * 캔버스 자체가 필요하다.
   */
  renderFrame() {
    if (!this.active) return null;
    this.scene.controls.update();
    this.scene.renderer.render(this.scene.scene, this.scene.camera);
    return this.scene.renderer.domElement;
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
