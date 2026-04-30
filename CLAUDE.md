# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 프로젝트 한 줄 요약

사진 한 장에서 그 사람만의 **음악(Tone.js) + 3D(Three.js) + AR 카드(MindAR)** 를 만드는 PWA.
"AR 디지털 명함" 콘셉트. 빌드 도구 없음, CDN 전용, 정적 파일.

---

## 사용자 프로필

- 이름: 하지훈 (danihoonhoon@gmail.com)
- 경험: 비개발자 — 첫 진지한 코딩 프로젝트
- 타깃 디바이스: iPhone (Safari)
- 선호: 빠른 결과, 최신 도구, 효율 우선. 쓸모없는 확인·설명 금지.

---

## 개발 명령

```bash
npm run dev          # public/ 을 http://localhost:8000 으로 서빙 (npx serve)
git push origin main # Cloudflare Pages 자동 배포 트리거 — 빌드 없음
```

배포: GitHub `main` 브랜치 push → Cloudflare Pages 자동 빌드 (output dir: `public/`, 빌드 명령 없음).
JS·CSS 변경 후에는 `sw.js` 의 `CACHE` 버전 문자열을 올려야 사용자 캐시가 갱신됨.

---

## 아키텍처 — 데이터 흐름

```
사진 업로드
  → feature-extractor.js   # 256×256 픽셀 통계 + SHA-256 → features{seed, hash, palette, meanLum, ...}
  → paramsFromFeatures()   # mulberry32(seed) → params{music, visual}  (결정적: 같은 사진 = 같은 결과)
  → card-renderer.js       # Canvas 2D로 카드 PNG 합성 → Blob
  → card-storage.js        # IndexedDB 저장 (id = 5자 무작위 문자열)
  → compileMindTarget()    # (선택) 카드 PNG → .mind ArrayBuffer (5~30초)
  → 공유 URL 생성          # location.origin + "/play.html" + ?id=X&data=JSON
```

**재생 시:**
```
play.html?id=X&data=JSON
  → ?id= → IndexedDB loadCard()  # 이 기기에서 생성한 카드 (AR 포함)
  → ?data= → parsePayload()      # 공유 링크 수신 (음악·3D만, AR 없음)
  → MusicEngine.start()          # Tone.js 생성 음악
  → VisualEngine.start()         # Three.js 절차적 3D
  → AREngine.start()             # MindARThree + Three.js AR (mindBuffer 있을 때만)
```

---

## 파일별 역할

| 파일 | 역할 |
|------|------|
| `js/feature-extractor.js` | 픽셀 통계 + SHA-256 → features, params 변환 |
| `js/music-engine.js` | Tone.js 무한 아르페지오·패드. `getLevel()` = RMS 0–1 (AR 비트 반응용) |
| `js/visual-engine.js` | Three.js 절차적 3D 형상 + 파티클 |
| `js/card-renderer.js` | Canvas 2D 카드 PNG 합성 |
| `js/card-storage.js` | IndexedDB CRUD. `blobToImage()`, `blobToDataUrl()` 헬퍼 포함 |
| `js/ar-engine.js` | MindARThree 이미지 트래킹 + 음악 비트 반응 애니메이션. `compileMindTarget()` 포함 |
| `js/generate.js` | generate.html 페이지 로직 (업로드·생성·저장·공유) |
| `js/play.js` | play.html 페이지 로직 (IndexedDB·URL 로드·재생·AR) |
| `sw.js` | 정적 자산 캐시-퍼스트 SW. navigate 요청은 바이패스 (iOS Safari 정책) |
| `index.html` | ?id= 또는 ?data= 파라미터 감지 시 play.html 로 즉시 리다이렉트 |

---

## 의존성 버전 (CDN 고정, 변경 금지)

```
Tone.js    15        — https://esm.sh/tone@15
Three.js   0.155.0  — importmap "three": "https://esm.sh/three@0.155.0"
MindAR     1.2.5    — https://esm.sh/mind-ar@1.2.5/...?deps=three@0.155.0
```

**Three.js 를 0.155.0 으로 고정하는 이유:** Three.js 0.159+ 에서 `sRGBEncoding` 상수가 삭제됨. MindAR 1.2.5 가 내부적으로 이 상수를 사용하므로, `?deps=three@0.155.0` 없이 최신 Three.js 와 함께 쓰면 `SyntaxError` 발생.

---

## IndexedDB 스키마

```
DB: aura-card-db  (version 1)
Store: cards  (keyPath: "id")
Card: { id, name, createdAt, features, params, cardImageBlob, sourcePhotoBlob, mindBuffer? }
```

---

## 공유 URL 생성 규칙

`generate.js` 에서 공유 URL 을 만들 때 **경로 교체 로직 사용 금지**.
pathname 조작은 Cloudflare clean URL (`/generate`) 에서 오작동함.
반드시 절대 경로 하드코딩:

```js
const base = location.origin + "/play.html";
const url  = `${base}?id=${id}&data=${sharePayload}`;
```

---

## iOS Safari 필수 규칙

- **오디오:** `Tone.start()` 는 반드시 사용자 제스처 핸들러 안에서 즉시 호출.
- **AR 카메라:** `arEngine.start()` 를 먼저, 그 후 `Tone.start()`. 순서 바꾸면 카메라 권한 실패.
- **HTTPS:** 카메라·오디오 모두 HTTPS 필수 (Cloudflare Pages 자동 제공).
- **파일 피커:** `<input type="file">` 에 `hidden` 속성 쓰지 말 것 — iOS가 `.click()` 무시함. `opacity:0; clip:rect(0,0,0,0)` 방식 사용.
- **Blob.arrayBuffer():** iOS Safari 일부 버전에서 실패 → `FileReader` 폴백 패턴 사용 (`play.js:blobToArrayBuffer`).
- **SW navigate:** SW 에서 navigate 요청 인터셉트 금지 — Safari 에서 리다이렉트 응답 반환 시 즉시 오류 발생.

---

## 자주 막히는 곳

| 증상 | 원인 | 해결 |
|------|------|------|
| 음악이 안 나옴 | 제스처 전 AudioContext 시작 | 클릭 핸들러에서 즉시 `Tone.start()` |
| AR 카메라 검은 화면 | HTTPS 아님 또는 순서 오류 | 배포 URL 사용, 카메라 먼저 시작 |
| MindAR `sRGBEncoding` SyntaxError | Three.js 버전 불일치 | `?deps=three@0.155.0` 확인 |
| 공유 링크가 generate 페이지로 튕김 | pathname 조작 버그 | `location.origin + "/play.html"` 하드코딩 |
| SW 업데이트 안 됨 | 캐시 이름 동일 | `sw.js` 의 `CACHE` 버전 올리기 |
| AR 인식 안 됨 | 카드 너무 작거나 흐림 | 인쇄 또는 큰 모니터 사용 |

---

## 스타일 가이드

- 커밋: Conventional Commits — `feat:`, `fix:`, `docs:`, `chore:`
- 브랜치: `main` 만 (1인 운영)
- 파일 크기 < 5MB (iOS Safari 메모리 친화)
- 코드 주석: 한국어 OK, **왜**를 설명 (무엇은 코드가 설명함)

---

**마지막 업데이트:** 2026-05-01
