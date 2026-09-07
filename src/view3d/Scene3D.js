// © 2026 김용현
/**
 * three.js 씬 껍데기 — 지형 메시 하나와 카메라를 들고 있다.
 *
 * e-GIS를 모른다. 정점 배열과 캔버스를 받아 그릴 뿐이다.
 * 이 경계 덕분에 지도 쪽이 바뀌어도 여기는 손대지 않는다.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { distanceForExtent } from './view3dMath.js';

export const FOV = 50;

export class Scene3D {
  /** @param {HTMLElement} container 캔버스를 담을 요소 */
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true   // PNG 저장에 필요하다
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfe8f3);   // 옅은 하늘색

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

    // 더블클릭한 지점으로 고정점을 옮긴다
    this.dblclickHandler = (event) => this.pickPivot(event);
    this.renderer.domElement.addEventListener('dblclick', this.dblclickHandler);

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

    const material = new THREE.MeshLambertMaterial({ map: this.texture, side: THREE.DoubleSide });
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
    this.scene.remove(this.pivotMarker);
    this.pivotMarker.geometry.dispose();
    this.pivotMarker.material.dispose();
    this.disposeTerrain();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
