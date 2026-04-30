/**
 * card-renderer.js
 * 사진 + 절차적 프레임 + 이름 → 1024×1024 Aura Card PNG 합성.
 *
 * 결과 카드는:
 *  - AR 인식이 잘 되도록 프레임에 풍부한 비대칭 패턴
 *  - 인쇄/공유에 적합한 명함 형태
 *  - 사용자 사진을 중심에 원형으로 배치
 */

import { mulberry32 } from "./feature-extractor.js";

const SIZE = 1024;

/**
 * @param {HTMLImageElement|ImageBitmap} photo
 * @param {string} name
 * @param {object} features
 * @param {object} params
 * @returns {Promise<{blob: Blob, dataUrl: string}>}
 */
export async function renderAuraCard(photo, name, features, params) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  const rand = mulberry32(features.seed);
  const palette = features.palette;

  // 1) 어두운 그라데이션 배경
  const grad = ctx.createRadialGradient(SIZE * 0.3, SIZE * 0.25, 30, SIZE * 0.5, SIZE * 0.5, SIZE * 0.7);
  grad.addColorStop(0, palette[0]);
  grad.addColorStop(0.5, "#0e0a1f");
  grad.addColorStop(1, "#05030f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 2) 외곽 절차적 프레임 패턴 (AR 인식 특징점 풍부)
  drawFrame(ctx, rand, palette);

  // 3) 사진 (원형 마스크)
  const photoR = SIZE * 0.27;
  const photoCx = SIZE * 0.5;
  const photoCy = SIZE * 0.46;
  ctx.save();
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  // 사진을 원에 맞춰 cover
  const pw = photo.width || photo.naturalWidth || SIZE;
  const ph = photo.height || photo.naturalHeight || SIZE;
  const scale = Math.max((photoR * 2) / pw, (photoR * 2) / ph);
  const dw = pw * scale;
  const dh = ph * scale;
  ctx.drawImage(photo, photoCx - dw / 2, photoCy - dh / 2, dw, dh);
  ctx.restore();

  // 사진 테두리
  ctx.strokeStyle = palette[2] || "#fff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
  ctx.stroke();

  // 4) 별·점 디테일 (특징점 추가)
  drawSparkles(ctx, rand);

  // 5) 비대칭 코너 마커 (방향 판별용)
  drawCornerMarkers(ctx, palette);

  // 6) 텍스트: 이름 + 시그니처 라인
  ctx.fillStyle = "#f5f0ff";
  ctx.font = "bold 56px -apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name || "Aura", SIZE / 2, SIZE * 0.83);

  ctx.fillStyle = "#a098c8";
  ctx.font = "22px -apple-system, system-ui, sans-serif";
  ctx.fillText(formatSignature(features, params), SIZE / 2, SIZE * 0.88);

  // 하단 메타 (해시 일부 + 키)
  ctx.fillStyle = "#5a5485";
  ctx.font = "16px ui-monospace, Menlo, monospace";
  const hashShort = features.hash.slice(0, 16);
  ctx.fillText(`AURA · ${hashShort}`, SIZE / 2, SIZE * 0.93);

  // Blob + dataURL
  const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
  const dataUrl = canvas.toDataURL("image/png");
  return { blob, dataUrl, canvas };
}

function drawFrame(ctx, rand, palette) {
  // 외곽 동심원 트랙
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  for (let i = 0; i < 7; i++) {
    const r = SIZE * 0.42 + i * 12;
    ctx.strokeStyle = withAlpha(palette[i % palette.length], 0.25);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 방사형 짧은 선 (랜덤 위치 — 비대칭)
  for (let i = 0; i < 96; i++) {
    const a = rand() * Math.PI * 2;
    const r1 = SIZE * 0.42;
    const r2 = r1 + 20 + rand() * 60;
    ctx.strokeStyle = withAlpha(palette[Math.floor(rand() * palette.length)], 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  // 도트
  for (let i = 0; i < 240; i++) {
    const a = rand() * Math.PI * 2;
    const r = SIZE * 0.43 + rand() * 80;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const sz = 1 + rand() * 3;
    ctx.fillStyle = withAlpha(palette[Math.floor(rand() * palette.length)], 0.85);
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSparkles(ctx, rand) {
  for (let i = 0; i < 360; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const a = rand() * 0.6 + 0.2;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const sz = rand() < 0.85 ? 1 : 2;
    ctx.fillRect(x, y, sz, sz);
  }
}

function drawCornerMarkers(ctx, palette) {
  // 좌상: 큰 사각형
  ctx.strokeStyle = palette[3] || "#ffd166";
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, 70, 70);
  ctx.fillStyle = palette[3] || "#ffd166";
  ctx.fillRect(56, 56, 38, 38);

  // 우상: 작은 원 + 점선
  ctx.beginPath();
  ctx.arc(SIZE - 75, 75, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = palette[1] || "#3b82f6";
  ctx.beginPath();
  ctx.arc(SIZE - 75, 75, 8, 0, Math.PI * 2);
  ctx.fill();

  // 좌하: 삼각형 (의도적으로 다른 모양)
  ctx.fillStyle = palette[4] || "#9ae6b4";
  ctx.beginPath();
  ctx.moveTo(50, SIZE - 105);
  ctx.lineTo(110, SIZE - 105);
  ctx.lineTo(80, SIZE - 50);
  ctx.closePath();
  ctx.fill();

  // 우하 없음 (비대칭 — AR 방향 추정에 도움)
}

function formatSignature(features, params) {
  const m = params.music;
  return `${m.key} ${m.scaleName.toUpperCase()} · ${m.tempo} BPM · ${params.visual.shape}`;
}

function withAlpha(hex, a) {
  // #rrggbb → rgba(...)
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
