/**
 * ar-engine.js
 * MindAR(이미지 인식) + Three.js 통합 — 카드 위에 절차적 3D를 띄움.
 *
 * 사용:
 *   const ar = new AREngine(containerEl, mindBuffer, params.visual, features.seed);
 *   await ar.start();   // 카메라 권한 요청 (사용자 제스처 필수)
 *   ar.stop();
 */

import * as THREE from "three";
// ?deps=three@0.155.0 : esm.sh 가 MindAR 내부의 bare 'three' import 를
// 0.155.0 으로 고정 → importmap 과 동일 인스턴스, sRGBEncoding 삭제 버전 회피
import { MindARThree } from "https://esm.sh/mind-ar@1.2.5/dist/mindar-image-three.prod.js?deps=three@0.155.0";

export class AREngine {
  /**
   * @param {HTMLElement} container - AR 캔버스가 들어갈 div
   * @param {ArrayBuffer|Uint8Array} mindBuffer - 컴파일된 .mind 데이터
   * @param {object} visualParams
   * @param {number} seed
   */
  constructor(container, mindBuffer, visualParams, seed) {
    this.container = container;
    this.params = visualParams;
    this.seed = seed >>> 0;
    this.mindBuffer = mindBuffer;
    this.started = false;
    this.onTargetFound = null;
    this.onTargetLost = null;
  }

  async start() {
    if (this.started) return;

    // mindBuffer → Blob URL
    const buf = this.mindBuffer instanceof ArrayBuffer ? this.mindBuffer : this.mindBuffer.buffer;
    const blob = new Blob([buf]);
    this._blobUrl = URL.createObjectURL(blob);

    this.mindar = new MindARThree({
      container: this.container,
      imageTargetSrc: this._blobUrl,
      maxTrack: 1,
      uiLoading: "no",
      uiScanning: "no",
      uiError: "no",
      filterMinCF: 0.0001,
      filterBeta: 0.01,
    });

    const { renderer, scene, camera } = this.mindar;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // 조명
    const palette = this.params.palette || ["#7c4dff", "#3b82f6", "#ff6b9d"];
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const light = new THREE.PointLight(new THREE.Color(palette[0]), 16, 8, 2);
    light.position.set(0, 0, 1.5);
    scene.add(light);

    // 카드 위 3D 메시
    const mesh = this._makeMesh(palette);
    const anchor = this.mindar.addAnchor(0);
    anchor.group.add(mesh);
    this.mesh = mesh;
    this.anchor = anchor;

    anchor.onTargetFound = () => { this.onTargetFound?.(); };
    anchor.onTargetLost  = () => { this.onTargetLost?.(); };

    await this.mindar.start();
    this.started = true;

    // 회전 애니메이션
    const speed = this.params.rotationSpeed || 0.3;
    renderer.setAnimationLoop(() => {
      const t = performance.now() / 1000;
      mesh.rotation.x = t * speed * 0.6;
      mesh.rotation.y = t * speed;
      renderer.render(scene, camera);
    });
  }

  _makeMesh(palette) {
    const p = this.params;
    let g;
    const detail = Math.max(1, Math.min(3, p.detail || 2));
    switch (p.shape) {
      case "sphere":       g = new THREE.SphereGeometry(0.25, 24, 18); break;
      case "icosahedron":  g = new THREE.IcosahedronGeometry(0.28, detail); break;
      case "torus":        g = new THREE.TorusGeometry(0.22, 0.08, 16, 48); break;
      case "torusKnot":    g = new THREE.TorusKnotGeometry(0.18, 0.06, 60, 12); break;
      case "tetrahedron":  g = new THREE.TetrahedronGeometry(0.32, detail); break;
      case "octahedron":   g = new THREE.OctahedronGeometry(0.30, detail); break;
      case "dodecahedron": g = new THREE.DodecahedronGeometry(0.28, detail); break;
      default:             g = new THREE.IcosahedronGeometry(0.28, detail);
    }
    // 왜곡
    let s = this.seed;
    const r = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s / 4294967296) * 2 - 1;
    };
    const k = (p.distortion || 0.2) * 0.5; // AR 모드는 살짝 약하게
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const len = Math.sqrt(x*x + y*y + z*z) || 1;
      const f = 1 + r() * k;
      pos.setXYZ(i, x / len * (len * f), y / len * (len * f), z / len * (len * f));
    }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[2] || palette[0]),
      roughness: 0.25,
      metalness: 0.6,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(0, 0, 0.05);
    return mesh;
  }

  stop() {
    if (!this.started) return;
    try {
      this.renderer.setAnimationLoop(null);
      this.mindar.stop();
    } catch {}
    if (this._blobUrl) URL.revokeObjectURL(this._blobUrl);
    this.started = false;
  }
}

/**
 * 카드 PNG (HTMLImageElement) 를 받아 .mind ArrayBuffer 로 컴파일.
 * 시간이 오래 걸리므로 (5~30초) 진행률 콜백을 받음.
 */
export async function compileMindTarget(imageElement, onProgress) {
  // 동적 import — 컴파일러 모듈은 큼
  const { Compiler } = await import("https://esm.sh/mind-ar@1.2.5/dist/mindar-image.prod.js");
  const compiler = new Compiler();
  await compiler.compileImageTargets([imageElement], (p) => {
    if (onProgress) onProgress(Math.round(p));
  });
  const buffer = await compiler.exportData();
  // buffer = Uint8Array
  return buffer;
}
