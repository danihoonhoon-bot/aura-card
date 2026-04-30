/**
 * visual-engine.js
 * Three.js 절차적 3D 형상 + 파티클 + 환경광 렌더링.
 *
 * 사용:
 *   const v = new VisualEngine(canvasEl, params.visual);
 *   v.start();
 *   v.stop();
 */

import * as THREE from "three";

export class VisualEngine {
  constructor(canvas, visualParams) {
    this.canvas = canvas;
    this.params = visualParams;
    this._running = false;
    this._raf = null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._setup();
    this._loop();
  }

  _setup() {
    const w = this.canvas.clientWidth || 360;
    const h = this.canvas.clientHeight || 360;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 4.5);

    // 조명: ambient + 두 개의 컬러 포인트라이트
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const palette = this.params.palette || ["#7c4dff", "#3b82f6", "#ff6b9d", "#fff2c4", "#9ae6b4"];
    const l1 = new THREE.PointLight(new THREE.Color(palette[0]), 18, 20, 2);
    l1.position.set(-3, 2, 3); this.scene.add(l1);
    const l2 = new THREE.PointLight(new THREE.Color(palette[1] || palette[0]), 14, 20, 2);
    l2.position.set(3, -2, 3); this.scene.add(l2);

    // 메인 메시
    const geom = this._makeGeometry();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[2] || palette[0]),
      roughness: 0.25,
      metalness: 0.6,
      flatShading: true,
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.mesh);

    // 파티클
    this.particles = this._makeParticles(palette);
    this.scene.add(this.particles);

    // 리사이즈 옵저버
    this._resize = () => {
      const w2 = this.canvas.clientWidth || 360;
      const h2 = this.canvas.clientHeight || 360;
      this.renderer.setSize(w2, h2, false);
      this.camera.aspect = w2 / h2;
      this.camera.updateProjectionMatrix();
    };
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(this._resize);
      this._ro.observe(this.canvas);
    } else {
      window.addEventListener("resize", this._resize);
    }
  }

  _makeGeometry() {
    const p = this.params;
    let g;
    const detail = Math.max(1, Math.min(4, p.detail || 2));
    switch (p.shape) {
      case "sphere":       g = new THREE.SphereGeometry(1, 32, 24); break;
      case "icosahedron":  g = new THREE.IcosahedronGeometry(1, detail); break;
      case "torus":        g = new THREE.TorusGeometry(0.85, 0.32, 24, 64); break;
      case "torusKnot":    g = new THREE.TorusKnotGeometry(0.7, 0.25, 80, 16); break;
      case "tetrahedron":  g = new THREE.TetrahedronGeometry(1.2, detail); break;
      case "octahedron":   g = new THREE.OctahedronGeometry(1.1, detail); break;
      case "dodecahedron": g = new THREE.DodecahedronGeometry(1, detail); break;
      default:             g = new THREE.IcosahedronGeometry(1, detail);
    }
    // vertex displacement (왜곡)
    const pos = g.attributes.position;
    const seed = (this.params.seed ?? 1234) >>> 0;
    let s = seed;
    const r = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return (s / 4294967296) * 2 - 1;
    };
    const k = p.distortion || 0.2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.sqrt(x*x + y*y + z*z) || 1;
      const f = 1 + r() * k;
      pos.setXYZ(i, x / len * (len * f), y / len * (len * f), z / len * (len * f));
    }
    g.computeVertexNormals();
    return g;
  }

  _makeParticles(palette) {
    const count = this.params.particleCount || 120;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = 1.6 + Math.random() * 1.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      tmp.set(palette[i % palette.length]);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
    });
    return new THREE.Points(geom, mat);
  }

  _loop() {
    if (!this._running) return;
    this._raf = requestAnimationFrame(() => this._loop());
    const t = performance.now() / 1000;
    const speed = this.params.rotationSpeed || 0.3;
    if (this.mesh) {
      this.mesh.rotation.x = t * speed * 0.6;
      this.mesh.rotation.y = t * speed;
    }
    if (this.particles) {
      this.particles.rotation.y = -t * speed * 0.4;
      this.particles.rotation.x = t * speed * 0.2;
    }
    this.renderer.render(this.scene, this.camera);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._resize) window.removeEventListener("resize", this._resize);
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
    if (this.particles) {
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
    if (this.renderer) this.renderer.dispose();
  }
}
