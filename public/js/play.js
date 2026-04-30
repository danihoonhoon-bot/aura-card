/**
 * play.js — play.html 페이지 로직.
 *
 * 카드 로드 우선순위:
 *  1. ?id=X → IndexedDB (이 기기에서 생성, AR 포함)
 *  2. #data=JSON → URL 해시 (공유 링크, 음악·3D만, AR 없음)
 */

import { loadCard, blobToImage } from "./card-storage.js";
import { MusicEngine } from "./music-engine.js";
import { VisualEngine } from "./visual-engine.js";
import { AREngine } from "./ar-engine.js";
import * as Tone from "https://esm.sh/tone@15";

const $ = (id) => document.getElementById(id);

const cardImg     = $("card-img");
const cardName    = $("card-name");
const cardSig     = $("card-sig");
const visualCanvas = $("visual-canvas");
const playBtn     = $("play-btn");
const stopBtn     = $("stop-btn");
const arBtn       = $("ar-btn");
const arContainer = $("ar-container");
const arHud       = $("ar-hud");
const arClose     = $("ar-close");
const status      = $("status");

let card         = null;
let musicEngine  = null;
let visualEngine = null;
let arEngine     = null;

// ─────────────── 초기화 ───────────────

async function init() {
  // 인앱 브라우저 감지 — 카메라·오디오 권한 제한 경고
  if (isInAppBrowser()) {
    const overlay = document.getElementById("inapp-overlay");
    if (overlay) overlay.style.display = "flex";
  }

  setStatus("카드 불러오는 중…");

  // 1) IndexedDB — 같은 기기에서 생성한 카드 (AR 지원)
  const id = new URLSearchParams(location.search).get("id");
  if (id) {
    card = await loadCard(id).catch(() => null);
  }

  // 2) URL 데이터 — 공유 링크 (?data= 또는 #data=, 음악·3D만)
  if (!card) {
    card = loadFromUrl();
  }

  if (!card) {
    setStatus("⚠️ 카드를 찾을 수 없어요. 링크를 다시 확인하거나 생성한 기기에서 열어주세요.", "error");
    return;
  }

  // 카드 이미지: IndexedDB 로드 시에만 표시
  if (card.cardImageBlob) {
    const img = await blobToImage(card.cardImageBlob);
    cardImg.src = img.src;
  } else {
    // 공유 링크로 받은 카드 — 이미지 없음, 캔버스만 표시
    cardImg.style.display = "none";
  }

  cardName.textContent = card.name;
  cardSig.textContent =
    `${card.params.music.key} ${card.params.music.scaleName.toUpperCase()} · ${card.params.music.tempo} BPM`;

  // 3D 시각화 시작
  visualEngine = new VisualEngine(visualCanvas, {
    ...card.params.visual,
    seed: card.features.seed,
  });
  visualEngine.start();

  // AR 버튼은 항상 표시 — mindBuffer 없을 때 클릭 시 안내 메시지 처리

  setStatus("▶ '아우라 듣기'를 눌러 음악을 시작하세요");
}

/**
 * URL 쿼리스트링(?data=) 또는 해시(#data=)에서 카드 데이터 복원.
 * 인앱 브라우저는 # 해시를 제거하므로 ?data= 를 우선 확인.
 */
function loadFromUrl() {
  // 1) 쿼리스트링 우선 — 인앱 브라우저 안전
  const qData = new URLSearchParams(location.search).get("data");
  if (qData) return parsePayload(qData);

  // 2) 해시 폴백 — 구버전 공유 링크 호환
  const hash = location.hash;
  if (hash.startsWith("#data=")) return parsePayload(hash.slice(6));

  return null;
}

function parsePayload(encoded) {
  try {
    const payload = JSON.parse(decodeURIComponent(encoded));
    if (!payload.features || !payload.params) return null;
    return {
      name:          payload.name || "Aura",
      features:      payload.features,
      params:        payload.params,
      cardImageBlob: null,
      mindBuffer:    null,
    };
  } catch {
    return null;
  }
}

// ─────────────── 음악 재생 ───────────────

playBtn.addEventListener("click", async () => {
  if (!card) return;
  // iOS Safari: AudioContext 언락 — 제스처 핸들러 진입 직후 즉시
  await Tone.start();
  playBtn.disabled = true;
  setStatus("🎵 시작 중…");
  try {
    if (musicEngine) await musicEngine.stop();
    musicEngine = new MusicEngine(card.params.music);
    await musicEngine.start();
    playBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
    setStatus("🎵 재생 중");
  } catch (e) {
    console.error(e);
    setStatus("⚠️ 오디오 시작 실패: " + e.message, "error");
  } finally {
    playBtn.disabled = false;
  }
});

stopBtn.addEventListener("click", async () => {
  stopBtn.disabled = true;
  if (musicEngine) {
    await musicEngine.stop();
    musicEngine = null;
  }
  stopBtn.classList.add("hidden");
  playBtn.classList.remove("hidden");
  stopBtn.disabled = false;
  setStatus("⏹ 정지");
});

// ─────────────── AR 모드 ───────────────

arBtn.addEventListener("click", async () => {
  if (!card?.mindBuffer) {
    setStatus("📷 AR은 카드를 만든 기기에서 열어야 사용할 수 있어요. 공유 링크 수신자는 음악·3D만 감상 가능합니다.", "error");
    return;
  }
  arBtn.disabled = true;
  setStatus("📷 카메라 준비 중…");
  arContainer.classList.add("active");
  arHud.textContent = "📸 카드 이미지를 카메라에 비춰주세요";

  try {
    // mindBuffer를 ArrayBuffer 로 변환 (iOS Safari: Blob.arrayBuffer() 대신 FileReader 우회)
    const buf = await blobToArrayBuffer(card.mindBuffer);

    arEngine = new AREngine(arContainer, buf, card.params.visual, card.features.seed);
    arEngine.onTargetFound = () => { arHud.textContent = "✨ 인식 성공"; };
    arEngine.onTargetLost  = () => { arHud.textContent = "🔍 카드를 비춰주세요"; };

    // 카메라 먼저 — iOS Safari 사용자 제스처 컨텍스트 보존
    await arEngine.start();

    // 카메라 확보 후 AudioContext 언락
    await Tone.start();
    if (!musicEngine) {
      musicEngine = new MusicEngine(card.params.music);
      await musicEngine.start();
      playBtn.classList.add("hidden");
      stopBtn.classList.remove("hidden");
    }
    arEngine.setMusicEngine(musicEngine);
    setStatus("📷 AR 모드");
  } catch (e) {
    console.error(e);
    arContainer.classList.remove("active");
    setStatus("⚠️ AR 시작 실패: " + e.message + " — 카메라 권한과 HTTPS 확인", "error");
  } finally {
    arBtn.disabled = false;
  }
});

arClose.addEventListener("click", () => {
  if (arEngine) { arEngine.stop(); arEngine = null; }
  arContainer.classList.remove("active");
  setStatus("AR 모드 종료");
});

window.addEventListener("beforeunload", () => {
  if (musicEngine) musicEngine.stop();
  if (visualEngine) visualEngine.stop();
  if (arEngine) arEngine.stop();
});

// ─────────────── helpers ───────────────

function isInAppBrowser() {
  const ua = navigator.userAgent;
  // 명시적 인앱 브라우저 UA
  if (/KAKAOTALK|NAVER|Instagram|FBAN|FB_IAB|Line\/|MicroMessenger|Snapchat/i.test(ua)) return true;
  // iOS 인앱 공통: AppleWebKit 있지만 Safari/ 없음
  if (/iPhone|iPad/.test(ua) && !/Safari\//.test(ua) && /AppleWebKit/.test(ua)) return true;
  return false;
}

function setStatus(msg, type = "info") {
  status.textContent = msg;
  status.className = "status " + type;
}

// iOS Safari 에서 Blob.arrayBuffer() 가 실패하는 경우 FileReader 로 우회
function blobToArrayBuffer(blob) {
  if (blob.arrayBuffer) {
    return blob.arrayBuffer().catch(() => _fileReaderArrayBuffer(blob));
  }
  return _fileReaderArrayBuffer(blob);
}
function _fileReaderArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

init().catch(e => {
  console.error(e);
  setStatus("⚠️ 초기화 실패: " + e.message, "error");
});
