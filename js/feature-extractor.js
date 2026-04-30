/**
 * feature-extractor.js
 * 사진 한 장에서 "이 사람만의" 음악·시각 파라미터를 뽑아내는 모듈.
 *
 * 입력: HTMLImageElement 또는 ImageBitmap
 * 출력: {features, music, visual}
 *
 * 같은 사진은 항상 같은 결과를 내고, 다른 사진은 거의 확실히 다른 결과를 냅니다.
 * (해시 기반 시드 + 픽셀 통계)
 */

const MUSIC_SCALES = {
  major:        [0, 2, 4, 5, 7, 9, 11],     // 밝고 따뜻
  minor:        [0, 2, 3, 5, 7, 8, 10],     // 어둡고 사색적
  pentatonic:   [0, 2, 4, 7, 9],            // 동양적, 부드러움
  dorian:       [0, 2, 3, 5, 7, 9, 10],     // 신비로움
  lydian:       [0, 2, 4, 6, 7, 9, 11],     // 우주적, 떠오름
  phrygian:     [0, 1, 3, 5, 7, 8, 10],     // 이국적, 어둠
};
const SCALE_NAMES = Object.keys(MUSIC_SCALES);

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const INSTRUMENT_PRESETS = [
  "amSynth", "fmSynth", "polySynth", "membrane", "metal", "pluck", "duo"
];

const SHAPE_PRESETS = [
  "sphere", "icosahedron", "torus", "torusKnot", "tetrahedron", "octahedron", "dodecahedron"
];

/**
 * 사진을 256×256 으로 다운샘플 후 픽셀 통계 + SHA-256 해시 추출.
 */
export async function extractFeatures(img) {
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  // 누적 통계
  let rSum = 0, gSum = 0, bSum = 0;
  let lumSum = 0;
  let hueSinSum = 0, hueCosSum = 0;
  let satSum = 0;
  const hueHist = new Array(12).fill(0);
  const lumHist = new Array(8).fill(0);

  const pixelCount = SIZE * SIZE;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    rSum += r; gSum += g; bSum += b;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lumSum += lum;
    lumHist[Math.min(7, Math.floor(lum * 8))]++;

    const sat = max === 0 ? 0 : (max - min) / max;
    satSum += sat;

    let hue = 0;
    const d = max - min;
    if (d > 0.001) {
      if (max === r)      hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else                hue = (r - g) / d + 4;
      hue = (hue * 60 + 360) % 360;
    }
    // 원형 평균을 위해 sin/cos 누적
    const rad = (hue * Math.PI) / 180;
    hueSinSum += sat * Math.sin(rad);
    hueCosSum += sat * Math.cos(rad);
    hueHist[Math.floor(hue / 30)]++;
  }

  const meanR = rSum / pixelCount;
  const meanG = gSum / pixelCount;
  const meanB = bSum / pixelCount;
  const meanLum = lumSum / pixelCount;
  const meanSat = satSum / pixelCount;
  const dominantHue = (Math.atan2(hueSinSum, hueCosSum) * 180 / Math.PI + 360) % 360;

  // 엔트로피 (휘도 히스토그램)
  let entropy = 0;
  for (const c of lumHist) {
    if (c === 0) continue;
    const p = c / pixelCount;
    entropy -= p * Math.log2(p);
  }
  // 정규화 0..1 (최대 log2(8) = 3)
  entropy = entropy / 3;

  // 엣지 밀도 (수평·수직 차이의 평균)
  let edgeSum = 0;
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const i = (y * SIZE + x) * 4;
      const cur = data[i] + data[i + 1] + data[i + 2];
      const right = data[i + 4] + data[i + 5] + data[i + 6];
      const down = data[i + SIZE * 4] + data[i + SIZE * 4 + 1] + data[i + SIZE * 4 + 2];
      edgeSum += Math.abs(cur - right) + Math.abs(cur - down);
    }
  }
  const edgeDensity = Math.min(1, edgeSum / (pixelCount * 255 * 2));

  // SHA-256 해시 → 16바이트 시드
  const hashBuf = await crypto.subtle.digest("SHA-256", data.buffer.slice(0));
  const hashBytes = new Uint8Array(hashBuf);
  const hashHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const seed = (hashBytes[0] << 24) | (hashBytes[1] << 16) | (hashBytes[2] << 8) | hashBytes[3];

  // 5색 팔레트 (히스토그램 상위 5개 색상 빈)
  const palette = topPalette(hueHist, meanSat, meanLum);

  return {
    seed: seed >>> 0,
    hash: hashHex,
    meanR, meanG, meanB,
    meanLum, meanSat,
    dominantHue,
    entropy,
    edgeDensity,
    palette,
  };
}

function topPalette(hueHist, sat, lum) {
  const indexed = hueHist.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => b.c - a.c);
  const top = indexed.slice(0, 5);
  return top.map(({ i }) => {
    const h = i * 30 + 15;
    return hslToHex(h, sat * 0.9, 0.4 + lum * 0.4);
  });
}

function hslToHex(h, s, l) {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60)       [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else              [r, g, b] = [c, 0, x];
  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

/**
 * 추출된 features 로부터 음악·시각 파라미터 생성.
 * 같은 features → 항상 같은 파라미터.
 */
export function paramsFromFeatures(features) {
  const f = features;
  // 시드 기반 의사 난수 (mulberry32) — 결정적이면서 분포 좋음
  const rand = mulberry32(f.seed);

  // 음악 키: dominant hue → 12 노트
  const keyIndex = Math.floor(f.dominantHue / 30);
  // 스케일: 휘도가 높으면 major/lydian 계열, 낮으면 minor/phrygian 계열
  let scaleName;
  if (f.meanLum > 0.65)      scaleName = rand() < 0.6 ? "lydian" : "major";
  else if (f.meanLum > 0.45) scaleName = rand() < 0.5 ? "major" : "pentatonic";
  else if (f.meanLum > 0.30) scaleName = rand() < 0.5 ? "dorian" : "minor";
  else                       scaleName = rand() < 0.5 ? "minor" : "phrygian";

  // 템포: 엣지 밀도 + 엔트로피 → 60..120 BPM
  const tempo = Math.round(60 + (f.edgeDensity * 0.7 + f.entropy * 0.3) * 60);

  // 악기: 채도가 높으면 fm/pluck, 낮으면 am/duo
  const instrumentIdx = Math.floor((f.meanSat * 0.6 + rand() * 0.4) * INSTRUMENT_PRESETS.length);
  const instrument = INSTRUMENT_PRESETS[Math.min(instrumentIdx, INSTRUMENT_PRESETS.length - 1)];

  // 아르페지오 길이: 4..8 노트
  const arpLen = 4 + Math.floor(rand() * 5);
  const arp = [];
  for (let i = 0; i < arpLen; i++) {
    arp.push(Math.floor(rand() * MUSIC_SCALES[scaleName].length));
  }
  // 옥타브 폭
  const octaveSpread = 1 + Math.floor(rand() * 3);

  // 잔향: 어두운 사진일수록 큼
  const reverb = 0.3 + (1 - f.meanLum) * 0.6;

  // 3D 형상 선택
  const shapeIdx = Math.floor((f.entropy * 0.5 + rand() * 0.5) * SHAPE_PRESETS.length);
  const shape = SHAPE_PRESETS[Math.min(shapeIdx, SHAPE_PRESETS.length - 1)];

  // 형상 디테일 (segments / detail)
  const detail = 1 + Math.floor(f.edgeDensity * 4);
  // 왜곡 강도 (vertex displacement)
  const distortion = 0.05 + f.entropy * 0.4 + rand() * 0.1;
  // 회전 속도
  const rotationSpeed = 0.1 + f.entropy * 0.5;
  // 파티클 개수
  const particleCount = Math.round(50 + f.edgeDensity * 250);

  return {
    music: {
      key: KEY_NAMES[keyIndex],
      keyIndex,
      scaleName,
      scale: MUSIC_SCALES[scaleName],
      tempo,
      instrument,
      arp,
      octaveSpread,
      reverb,
    },
    visual: {
      shape,
      detail,
      distortion,
      rotationSpeed,
      particleCount,
      palette: f.palette,
    },
  };
}

/** 결정적 의사 난수 — 같은 시드는 같은 시퀀스 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export { mulberry32 };
