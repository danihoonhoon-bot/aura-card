/**
 * generate.js — generate.html 페이지 로직.
 * 사진 업로드 → 분석 → 카드 생성 → 미리듣기 → 저장.
 */

import { extractFeatures, paramsFromFeatures } from "./feature-extractor.js";
import { renderAuraCard } from "./card-renderer.js";
import { MusicEngine } from "./music-engine.js";
import { VisualEngine } from "./visual-engine.js";
import { saveCard } from "./card-storage.js";
import { compileMindTarget } from "./ar-engine.js";
import * as Tone from "https://esm.sh/tone@15";

const $ = (id) => document.getElementById(id);

const fileInput = $("file-input");
const dropZone = $("drop-zone");
const nameInput = $("name-input");
const generateBtn = $("generate-btn");
const status = $("status");

const previewSection = $("preview-section");
const cardImg = $("card-img");
const visualCanvas = $("visual-canvas");
const playMusicBtn = $("play-music-btn");
const stopMusicBtn = $("stop-music-btn");
const saveBtn = $("save-btn");
const shareLink = $("share-link");
const shareUrlDisplay = $("share-url-display");
const paramsDisplay = $("params-display");

let loadedImage = null;       // HTMLImageElement
let lastGenerated = null;     // {features, params, blob, dataUrl}
let visualEngine = null;
let musicEngine = null;

// ─────────────── 파일 업로드 ───────────────

dropZone.addEventListener("click", () => fileInput.click());

["dragover", "dragenter"].forEach(ev => {
  dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.add("dragging");
  });
});
["dragleave", "drop"].forEach(ev => {
  dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.remove("dragging");
  });
});
dropZone.addEventListener("drop", e => {
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});
fileInput.addEventListener("change", e => {
  const f = e.target.files?.[0];
  if (f) handleFile(f);
});

async function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    setStatus("이미지 파일만 가능해요.", "error");
    return;
  }
  setStatus("이미지를 불러오는 중…");
  const url = URL.createObjectURL(file);
  loadedImage = await loadImage(url);
  loadedImage._sourceFile = file;
  dropZone.innerHTML = `<img src="${url}" class="thumb" alt="업로드한 사진"/><div class="thumb-label">다른 사진 선택</div>`;
  generateBtn.disabled = false;
  setStatus("준비됨. '아우라 생성' 버튼을 누르세요.");
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

// ─────────────── 카드 생성 ───────────────

generateBtn.addEventListener("click", async () => {
  if (!loadedImage) return;
  generateBtn.disabled = true;
  setStatus("✨ 분석 중…");
  try {
    const features = await extractFeatures(loadedImage);
    const params = paramsFromFeatures(features);

    setStatus("🎨 카드 합성 중…");
    const name = (nameInput.value || "Aura").trim();
    const { blob, dataUrl, canvas } = await renderAuraCard(loadedImage, name, features, params);

    lastGenerated = { features, params, blob, dataUrl, name, sourceFile: loadedImage._sourceFile };

    // 미리보기
    cardImg.src = dataUrl;
    previewSection.classList.remove("hidden");

    // 파라미터 표시
    paramsDisplay.innerHTML = `
      <div><b>키</b>: ${params.music.key} ${params.music.scaleName.toUpperCase()}</div>
      <div><b>템포</b>: ${params.music.tempo} BPM</div>
      <div><b>악기</b>: ${params.music.instrument}</div>
      <div><b>형상</b>: ${params.visual.shape}</div>
      <div><b>해시</b>: <code>${features.hash.slice(0, 16)}</code></div>
    `;

    // 3D 미리보기 시작
    if (visualEngine) visualEngine.stop();
    visualEngine = new VisualEngine(visualCanvas, { ...params.visual, seed: features.seed });
    visualEngine.start();

    setStatus("✅ 생성 완료. 음악도 들어보세요.");
    previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    setStatus("⚠️ 생성 실패: " + e.message, "error");
  } finally {
    generateBtn.disabled = false;
  }
});

// ─────────────── 음악 미리듣기 ───────────────

playMusicBtn.addEventListener("click", async () => {
  if (!lastGenerated) return;
  // iOS Safari: AudioContext는 제스처 핸들러 최초 진입 시 즉시 언락해야 함
  await Tone.start();
  if (musicEngine) await musicEngine.stop();
  musicEngine = new MusicEngine(lastGenerated.params.music);
  playMusicBtn.disabled = true;
  setStatus("🎵 음악 시작 중…");
  try {
    await musicEngine.start();
    playMusicBtn.classList.add("hidden");
    stopMusicBtn.classList.remove("hidden");
    setStatus("🎵 재생 중");
  } catch (e) {
    console.error(e);
    setStatus("⚠️ 오디오 시작 실패: " + e.message, "error");
  } finally {
    playMusicBtn.disabled = false;
  }
});

stopMusicBtn.addEventListener("click", async () => {
  if (musicEngine) {
    stopMusicBtn.disabled = true;
    await musicEngine.stop();
    musicEngine = null;
    stopMusicBtn.classList.add("hidden");
    playMusicBtn.classList.remove("hidden");
    stopMusicBtn.disabled = false;
    setStatus("⏹ 정지");
  }
});

// ─────────────── 저장 + 공유 링크 ───────────────

saveBtn.addEventListener("click", async () => {
  if (!lastGenerated) return;
  saveBtn.disabled = true;
  setStatus("💾 저장 중…");
  try {
    // AR 컴파일 (선택) — 체크박스가 켜져 있으면 진행
    let mindBuffer = null;
    const enableAR = document.getElementById("enable-ar")?.checked;
    if (enableAR) {
      setStatus("🎯 AR 타겟 컴파일 중… (카드가 클수록 오래 걸려요. 5~30초)");
      const cardImg = await loadImage(lastGenerated.dataUrl);
      try {
        mindBuffer = await compileMindTarget(cardImg, (p) => {
          setStatus(`🎯 AR 타겟 컴파일 중… ${p}%`);
        });
      } catch (e) {
        console.warn("MindAR 컴파일 실패, AR 없이 저장:", e);
        setStatus("⚠️ AR 컴파일 실패 — 음악·시각만 저장합니다.", "error");
      }
    }

    const card = {
      name: lastGenerated.name,
      features: lastGenerated.features,
      params: lastGenerated.params,
      cardImageBlob: lastGenerated.blob,
      sourcePhotoBlob: lastGenerated.sourceFile, // File extends Blob
      mindBuffer: mindBuffer ? new Blob([mindBuffer]) : null,
    };
    const id = await saveCard(card);

    // ?data= 쿼리스트링으로 직렬화 — 인앱 브라우저는 #해시를 제거하므로 쿼리만 사용
    // 필요한 최소 필드만 인코딩해 URL 길이 절약
    const sharePayload = encodeURIComponent(JSON.stringify({
      name: lastGenerated.name,
      features: {
        seed:    lastGenerated.features.seed,
        hash:    lastGenerated.features.hash,
        palette: lastGenerated.features.palette,
      },
      params: lastGenerated.params,
    }));
    const base = `${location.origin}${location.pathname.replace(/generate\.html$/, "play.html")}`;
    // ?id=X — 이 기기 IndexedDB(AR 포함) / &data=Y — 어디서나 음악·3D
    const url = `${base}?id=${id}&data=${sharePayload}`;
    shareUrlDisplay.value = url;
    shareLink.href = url;
    shareLink.classList.remove("hidden");
    document.getElementById("share-block").classList.remove("hidden");
    setStatus(mindBuffer
      ? "✅ 저장됨! AR 모드 활성화됨. 공유 링크 준비 완료."
      : "✅ 저장됨! (AR 없이 음악·시각만)");
  } catch (e) {
    console.error(e);
    setStatus("⚠️ 저장 실패: " + e.message, "error");
  } finally {
    saveBtn.disabled = false;
  }
});

document.getElementById("copy-url-btn")?.addEventListener("click", () => {
  shareUrlDisplay.select();
  navigator.clipboard.writeText(shareUrlDisplay.value).then(() => {
    setStatus("📋 링크 복사됨");
  });
});

// 다운로드
document.getElementById("download-btn")?.addEventListener("click", () => {
  if (!lastGenerated) return;
  const a = document.createElement("a");
  a.href = lastGenerated.dataUrl;
  a.download = `aura-card-${lastGenerated.name}.png`;
  a.click();
});

// ─────────────── helpers ───────────────

function setStatus(msg, type = "info") {
  status.textContent = msg;
  status.className = "status " + type;
}
