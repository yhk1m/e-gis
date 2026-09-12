// © 2026 김용현
/**
 * three.js 씬 껍데기 — 지형 메시 하나와 카메라를 들고 있다.
 *
 * e-GIS를 모른다. 정점 배열과 캔버스를 받아 그릴 뿐이다.
 * 이 경계 덕분에 지도 쪽이 바뀌어도 여기는 손대지 않는다.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { distanceForExtent, viewBearing } from './view3dMath.js';

export const FOV = 50;

/** 하늘색 — 배경과 안개가 같아야 가장자리가 자연스럽게 사라진다 */
const BACKGROUND = 0xdfe8f3;

/** 두 번 탭으로 볼 시간·거리 — 손가락은 마우스보다 흔들린다 */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 32;

export class Scene3D {
  /**
   * @param {HTMLElement} container 캔버스를 담을 요소
   * @param {{pixelRatio?: number}} options 태블릿·휴대폰에서는 픽셀비를 낮춰 받는다
   */
  constructor(container, { pixelRatio } = {}) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true   // PNG 저장에 필요하다
    });
    this.renderer.setPixelRatio(pixelRatio || Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND);   // 옅은 하늘색
    // 지형 가장자리를 배경색으로 풀어 잘린 선이 드러나지 않게 한다
    this.scene.fog = new THREE.Fog(BACKGROUND, 1, 2);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 5000000);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = (Math.PI / 2) * 0.95;   // 지평선 아래로 못 내려간다

    // 지도 그림을 살리려고 환경광을 세게, 방향광을 약하게 준다
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(-1, 2, 1);
    this.scene.add(sun);

    this.terrain = null;
    this.texture = null;
    this.running = false;
    this.frameId = null;
    this.onCameraChange = null;
    this.onPivotMoved = null;

    // 회전 중심(고정점) 표시 — 어디를 축으로 도는지 보이지 않으면 조작이 어렵다
    this.pivotMarker = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xff3b30, depthTest: false, transparent: true, opacity: 0.9 })
    );
    this.pivotMarker.renderOrder = 999;
    this.scene.add(this.pivotMarker);

    this.raycaster = new THREE.Raycaster();

    this.controls.addEventListener('change', () => {
      if (this.onCameraChange) this.onCameraChange();
    });

    // 더블클릭(마우스)한 지점으로 고정점을 옮긴다
    this.dblclickHandler = (event) => this.pickPivot(event);
    this.renderer.domElement.addEventListener('dblclick', this.dblclickHandler);

    // 터치에서는 dblclick을 기대할 수 없다 — 두 번 탭을 직접 센다
    this.lastTap = null;
    this.tapHandler = (event) => {
      if (event.pointerType !== 'touch') return;
      const now = Date.now();
      const previous = this.lastTap;
      this.lastTap = { time: now, x: event.clientX, y: event.clientY };
      if (!previous) return;
      const quick = now - previous.time < DOUBLE_TAP_MS;
      const near = Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < DOUBLE_TAP_PX;
      if (quick && near) {
        this.lastTap = null;
        this.pickPivot(event);
      }
    };
    this.renderer.domElement.addEventListener('pointerdown', this.tapHandler);

    this.resize();
  }

  /** 더블클릭 지점의 지형을 찾아 고정점으로 삼는다 */
  pickPivot(event) {
    if (!this.terrain) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.terrain, false)[0];
    if (!hit) return;

    // 카메라는 그대로 두고 바라보는 점만 옮긴다 — 화면이 그 점을 중심으로 다시 잡힌다
    this.controls.target.copy(hit.point);
    this.controls.update();
    if (this.onPivotMoved) this.onPivotMoved();
  }

  /**
   * 지형 크기에 맞춰 안개 범위를 잡는다.
   *
   * 기본 시야에서 눈에 보이는 가장 먼 땅은 카메라로부터 메시 폭의 0.48배쯤이고
   * 메시 끝은 0.52배쯤이다. 그 사이에서 서서히 풀어 잘린 선을 가린다.
   *
   * @param {number} span 메시가 덮는 폭(미터)
   */
  setFog(span) {
    if (!this.scene.fog || !(span > 0)) return;
    this.scene.fog.near = span * 0.35;
    this.scene.fog.far = span * 0.52;
  }

  /** 카메라가 바라보는 방위각(라디안) — 방위표시를 돌리는 데 쓴다 */
  getBearing() {
    return viewBearing(this.camera.position, this.controls.target);
  }

  /** 고정점 표시를 숨기거나 다시 보인다 — 화면을 저장할 때 빨간 점이 걸리적거릴 수 있다 */
  setPivotMarkerVisible(visible) {
    this.pivotMarker.visible = Boolean(visible);
  }

  /** 고정점 표시를 카메라 거리에 맞춰 키운다 — 멀어져도 보이게 */
  updatePivotMarker() {
    const distance = this.camera.position.distanceTo(this.controls.target);
    const size = Math.max(distance / 150, 1e-3);
    this.pivotMarker.position.copy(this.controls.target);
    this.pivotMarker.scale.setScalar(size);
  }

  /** 지형 메시를 갈아 끼운다. 이전 것은 반드시 버린다(GPU 메모리 누수 방지) */
  setTerrain({ positions, uvs, indices }, textureCanvas) {
    this.disposeTerrain();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    this.texture = new THREE.CanvasTexture(textureCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshLambertMaterial({ map: this.texture, side: THREE.DoubleSide, fog: true });
    this.terrain = new THREE.Mesh(geometry, material);
    this.scene.add(this.terrain);
  }

  /** 카메라를 45° 기울여 범위 전체가 보이게 놓는다 */
  frameExtent(spanX, spanY, groundY = 0) {
    const distance = distanceForExtent(Math.max(spanX, spanY), FOV);
    const tilt = Math.PI / 4;
    this.controls.target.set(0, groundY, 0);
    this.camera.position.set(
      0,
      groundY + distance * Math.sin(tilt),
      distance * Math.cos(tilt)
    );
    this.controls.update();
  }

  /** 고정점을 옮기고 카메라도 같은 만큼 따라 옮긴다(보는 방향·거리 유지) */
  moveTargetTo(x, y, z) {
    const dx = x - this.controls.target.x;
    const dy = y - this.controls.target.y;
    const dz = z - this.controls.target.z;
    this.camera.position.set(
      this.camera.position.x + dx,
      this.camera.position.y + dy,
      this.camera.position.z + dz
    );
    this.controls.target.set(x, y, z);
    this.controls.update();
  }

  /** 메시 원점이 옮겨간 만큼 카메라와 타깃을 민다 */
  shift(dx, dz) {
    this.camera.position.x += dx;
    this.camera.position.z += dz;
    this.controls.target.x += dx;
    this.controls.target.z += dz;
    this.controls.update();
  }

  resize() {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    // 세 번째 인자를 false로 두면 three가 캔버스 CSS 크기를 정하지 않는다.
    // 그러면 캔버스는 픽셀비가 곱해진 속성 크기(예: 1122 × 1.5 = 1683)를 그대로
    // 레이아웃 크기로 써서 지도 밖으로 넘치고, 화면은 왼쪽 위만 잘려 보인다.
    // 고DPI 화면에서만 드러나므로 반드시 스타일까지 맡겨야 한다.
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.frameId = requestAnimationFrame(tick);
      this.controls.update();
      this.updatePivotMarker();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  stop() {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
  }

  disposeTerrain() {
    if (!this.terrain) return;
    this.scene.remove(this.terrain);
    this.terrain.geometry.dispose();
    this.terrain.material.dispose();
    this.terrain = null;
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }

  dispose() {
    this.stop();
    this.renderer.domElement.removeEventListener('dblclick', this.dblclickHandler);
    this.renderer.domElement.removeEventListener('pointerdown', this.tapHandler);
    this.scene.remove(this.pivotMarker);
    this.pivotMarker.geometry.dispose();
    this.pivotMarker.material.dispose();
    this.disposeTerrain();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
