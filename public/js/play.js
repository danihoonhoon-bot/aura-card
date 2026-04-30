/**
 * play.js — play.html 페이지 로직.
 * URL ?id=XXXX 로 저장된 카드를 불러와 음악 + 3D 시각화 + AR(옵션) 재생.
 */

import { loadCard, blobToImage } from "./card-storage.js";
import { MusicEngine } from "./music-engine.js";
import { VisualEngine } from "./visual-engine.js";
import { AREngine } from "./ar-engine.js";
import * as Tone from "https://esm.sh/tone@15";

const $ = (id) => document.getElementById(id);

const cardImg = $("card-img");
const cardName = $("card-name");
const cardSig = $("card-sig");
const visualCanvas = $("visual-canvas");
const playBtn = $("play-btn");
const stopBtn = $("stop-btn");
const arBtn = $("ar-btn");
const arContainer = $("ar-container");
const arHud = $("ar-hud");
const arClose = $("ar-close");
const status = $("status");

let card = null;
let musicEngine = null;
let visualEngine = null;
let arEngine = null;

async function init() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) {
    setStatus("⚠️ 카드 ID가 없어요. 링크를 다시 확인해주세요.", "error");
    return;
  }

  setStatus("카드 불러오는 중…");
  card = await loadCard(id);
  if (!card) {
    setStatus("⚠️ 이 디바이스에 저장된 카드가 없어요. 발급한 디바이스에서 열거나 카드를 다시 받아주세요.", "error");
    return;
  }

  // 카드 이미지 표시
  const img = await blobToImage(card.cardImageBlob);
  cardImg.src = img.src;
  cardName.textContent = card.name;
  cardSig.textContent = `${card.params.music.key} ${card.params.music.scaleName.toUpperCase()} · ${card.params.music.tempo} BPM`;

  // 3D 시각화 시작
  visualEngine = new VisualEngine(visualCanvas, { ...card.params.visual, seed: card.features.seed });
  visualEngine.start();

  // AR 가능 여부
  if (card.mindBuffer) {
    arBtn.classList.remove("hidden");
  }

  setStatus("▶ '아우라 듣기'를 눌러 음악을 시작하세요");
}

playBtn.addEventListener("click", async () => {
  if (!card) return;
  // iOS Safari: AudioContext 언락은 제스처 핸들러 진입 직후 즉시
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
  if (!card?.mindBuffer) return;
  // iOS Safari: AR 시작 시 음악도 자동 재생되므로 여기서도 언락
  await Tone.start();
  arBtn.disabled = true;
  setStatus("📷 카메라 준비 중…");
  arContainer.classList.add("active");
  arHud.textContent = "📸 카드 이미지를 카메라에 비춰주세요";

  try {
    const buf = await card.mindBuffer.arrayBuffer();
    arEngine = new AREngine(arContainer, buf, card.params.visual, card.features.seed);
    arEngine.onTargetFound = () => { arHud.textContent = "✨ 인식 성공"; };
    arEngine.onTargetLost  = () => { arHud.textContent = "🔍 카드를 비춰주세요"; };
    await arEngine.start();

    // AR 시작 시 음악도 자동 재생 (이미 재생 중이면 그대로)
    if (!musicEngine) {
      musicEngine = new MusicEngine(card.params.music);
      await musicEngine.start();
      playBtn.classList.add("hidden");
      stopBtn.classList.remove("hidden");
    }
    // 음악 엔진 주입 — 비트 반응 3D 활성화
    arEngine.setMusicEngine(musicEngine);
    setStatus("📷 AR 모드");
  } catch (e) {
    console.error(e);
    arContainer.classList.remove("active");
    setStatus("⚠️ AR 시작 실패: " + e.message + " — 카메라 권한과 HTTPS 접속 확인", "error");
  } finally {
    arBtn.disabled = false;
  }
});

arClose.addEventListener("click", () => {
  if (arEngine) {
    arEngine.stop();
    arEngine = null;
  }
  arContainer.classList.remove("active");
  setStatus("AR 모드 종료");
});

window.addEventListener("beforeunload", () => {
  if (musicEngine) musicEngine.stop();
  if (visualEngine) visualEngine.stop();
  if (arEngine) arEngine.stop();
});

function setStatus(msg, type = "info") {
  status.textContent = msg;
  status.className = "status " + type;
}

init().catch(e => {
  console.error(e);
  setStatus("⚠️ 초기화 실패: " + e.message, "error");
});
