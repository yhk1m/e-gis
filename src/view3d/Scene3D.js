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

    this.controls.addEventListener('change', () => {
      if (this.onCameraChange) this.onCameraChange();
    });

    this.resize();
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
    this.renderer.setSize(width, height, false);
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
    this.disposeTerrain();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
