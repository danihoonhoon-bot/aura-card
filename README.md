# Aura · 음악·시각 디지털 명함 PWA

> 사람의 얼굴·지문·공간이 모두 다르듯이, **사진 한 장에서 그 사람만의 음악과 3D 형상을 만들어내는** 디지털 명함.

---

## 콘셉트

```
[사진 업로드] ──→ [Canvas로 색·엣지·해시 추출] ──→ [음악·시각 파라미터 도출]
                                                           │
                            ┌──────────────────────────────┼─────────────────────────┐
                            ▼                              ▼                         ▼
                  Tone.js 생성 음악              Three.js 절차적 3D            Aura Card 합성 PNG
                  (키·스케일·템포·악기)         (형상·왜곡·파티클·색)        (사진+절차 프레임+이름)
                            │                              │                         │
                            └──────── PWA + IndexedDB ─────┴─── MindAR (옵션) ────────┘
                                          │
                                  공유 링크 / QR / 인쇄
```

같은 사진은 항상 같은 결과 → "내 아우라"는 결정적·고유.
다른 사진은 거의 확실히 다른 결과 → 만 명이면 만 가지 음악.

---

## 무엇을 할 수 있나

- **/ (랜딩)** — 콘셉트 소개 + 만들기 CTA
- **/generate.html** — 사진 업로드 → 분석 → 카드 생성 → 음악 미리듣기 → 저장 + 공유 링크
- **/play.html?id=XXXX** — 받는 사람이 카드 재생 (음악 + 3D + AR 옵션)

PWA로 iPhone Safari "홈 화면에 추가" 하면 앱 아이콘이 생기고, 오프라인에서도 자산이 캐싱됩니다.

---

## 파일 구조

```
aura-card/
├── index.html            랜딩
├── generate.html         카드 만들기
├── play.html             재생 (음악 + 3D + AR 모드)
├── manifest.json         PWA manifest
├── sw.js                 Service Worker
├── package.json          로컬 dev 서버
├── .gitignore
├── README.md             ← 이 파일
├── CLAUDE.md             Claude Code 작업 컨텍스트
├── FIRST_PROMPT.md       Claude Code 첫 프롬프트
├── css/
│   └── style.css
├── icons/
│   ├── icon-192.png      (Python으로 생성됨)
│   └── icon-512.png
├── js/
│   ├── feature-extractor.js   사진 → 파라미터
│   ├── music-engine.js        Tone.js 음악 엔진
│   ├── visual-engine.js       Three.js 3D 엔진
│   ├── card-renderer.js       카드 PNG 합성
│   ├── card-storage.js        IndexedDB 저장
│   ├── ar-engine.js           MindAR + Three.js (AR 모드)
│   ├── generate.js            generate.html 로직
│   └── play.js                play.html 로직
└── tools/
    ├── generate_icons.py      아이콘 재생성
    └── (예전 ar-project 보관)
```

---

## 기술 스택

| 영역 | 도구 | 왜 |
|------|------|-----|
| 음악 합성 | Tone.js 15 (CDN) | 브라우저 실시간 합성, 저작권 자유, 무한 변형 |
| 3D 렌더 | Three.js 0.160 (CDN) | 절차적 형상, 파티클, AR 모드 공유 |
| AR 인식 | MindAR 1.2.5 | 인-브라우저 컴파일 가능, iOS Safari 지원 |
| 사진 분석 | Canvas API + Web Crypto SHA-256 | 외부 의존 0 |
| 저장 | IndexedDB | 큰 Blob 저장 (사진·카드·.mind 데이터) |
| 배포 | Cloudflare Pages | git push 자동 재배포, 무료 HTTPS |
| 앱화 | PWA (manifest + sw) | 빌드 단계 0, 홈 화면 설치 |

**빌드 도구 없음.** 정적 파일 그대로 호스팅합니다.

---

## 처음 세팅 / 로컬 실행

```bash
cd aura-card
npm run dev          # http://localhost:8000
```

브라우저에서 `http://localhost:8000` 열기. **localhost 는 HTTPS 없이도 카메라·마이크 허용됨** (브라우저 특례).

---

## 배포 (Cloudflare Pages)

1. https://pages.cloudflare.com 접속 → Create a project → Connect to Git
2. GitHub 저장소 연결 → 이 프로젝트 선택
3. Build settings:
   - Framework preset: **None**
   - Build command: *(비움)*
   - Build output directory: **`/`**
4. Save and Deploy → 1~2분 후 `https://aura-card-xxxx.pages.dev` 발급
5. iPhone Safari 에서 그 URL 열고 **공유 → 홈 화면에 추가** = 앱 설치 완료

---

## 사용 흐름 (사용자 시나리오)

### 명함 만드는 사람
1. PWA 열기 → "아우라 만들기"
2. 본인 사진 업로드 + 이름 입력
3. "✨ 아우라 생성" 클릭 → 즉시 카드·3D·음악 미리듣기
4. (선택) AR 활성화 체크 → "💾 저장 + 공유 링크 만들기"
5. 공유 URL 받기 → 카드 PNG 다운로드 → 인쇄·SNS·QR

### 명함 받는 사람
1. 공유 링크 (또는 QR) 열기 → play.html 자동 로드
2. 카드 이미지 + 3D 형상 + "🎵 아우라 듣기" 버튼
3. 클릭하면 음악 시작
4. AR 카드라면 "📷 AR 모드" → 카메라로 인쇄 카드 비추면 그 위에 3D 등장

---

## AR 모드 동작 원리

```
[generate.html에서 카드 생성 시점]
   카드 PNG 합성 ──→ MindAR Compiler API 인-브라우저 실행
                  ──→ ArrayBuffer (.mind) 생성 (5~30초)
                  ──→ IndexedDB에 Blob으로 저장

[play.html에서 AR 모드 클릭 시점]
   IndexedDB 에서 .mind Blob 로드 ──→ Blob URL 생성
                                   ──→ MindARThree 인스턴스 시작
                                   ──→ 카메라 켜짐 + 인식 시작
                                   ──→ 카드 인식되면 절차적 3D 표시
```

---

## iOS Safari 주의사항

- HTTPS 필수 (Cloudflare Pages 가 자동 처리). 로컬은 localhost 예외.
- 카메라 권한은 **페이지 로드마다 재요청** (Apple 정책, 버그 아님).
- 홈 화면에 추가하면 PWA 모드로 실행 → 권한이 비교적 잘 유지됨.
- 첫 음악 시작은 **사용자 탭** 이후만 가능 (AudioContext 정책).

---

## 커스터마이징 가이드

### 음악 매핑 바꾸기 (어떤 사진이 어떤 음악 되나)
`js/feature-extractor.js`의 `paramsFromFeatures()` 안에서:
- `scaleName` 결정 (휘도 → 스케일)
- `tempo` 계산식 (엣지 + 엔트로피)
- `instrument` 선택 분기
이 부분을 만지면 본인 취향에 맞는 매핑으로 변경 가능.

### 3D 형상 추가
`js/visual-engine.js` + `js/ar-engine.js`의 `_makeMesh()` switch 에 새 case 추가, `feature-extractor.js`의 `SHAPE_PRESETS` 에도 추가.

### 카드 디자인 변경
`js/card-renderer.js`의 `drawFrame`, `drawCornerMarkers`, `formatSignature` 수정.

---

## 다른 Mac에서 이어 작업하기 (rule #4)

GitHub 저장소가 **단일 진실 원천**. 어느 Mac에서든:

```bash
gh repo clone <user>/aura-card
cd aura-card
npm run dev          # 즉시 로컬 서버 띄움
# 작업 후
git add . && git commit -m "feat: ..." && git push
# Cloudflare Pages 가 자동으로 재배포
```

처음 1회 세팅은 `FIRST_PROMPT.md` 참고.

---

## 로드맵

- ✅ **v0.1** (이번 빌드) — 음악 + 3D + 카드 + AR + PWA
- ⬜ **v0.2** — 서버리스 백엔드 (Cloudflare Workers + R2) — 다른 디바이스에서도 카드 열기
- ⬜ **v0.3** — Capacitor 래핑 → Xcode → iOS 네이티브 앱 → App Store
- ⬜ **v0.4** — 공간 스캔 (LiDAR) → 방 전체를 음악으로
- ⬜ **v0.5** — Spotify 연동 → 본인 플레이리스트가 카드의 분위기에 영향
- ⬜ **v0.6** — NFC 태그 인쇄 → 태그하면 카드 재생

---

## 라이선스

MIT. 사진은 본인 것, 음악은 Tone.js 생성, 3D는 절차적 — 저작권 분쟁 0.

---

**v0.1.0 · 2026-04-30**
