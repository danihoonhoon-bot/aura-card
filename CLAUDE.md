# Claude Code 컨텍스트 — aura-card

이 파일은 Claude Code가 이 프로젝트를 이해하도록 돕는 컨텍스트입니다.
`cd aura-card && claude` 로 진입하면 자동으로 읽혀요.

---

## 프로젝트 한 줄 요약

사진 한 장에서 그 사람만의 **음악(Tone.js) + 3D(Three.js) + AR 카드(MindAR)** 를 만드는 PWA.
"AR 디지털 명함" 콘셉트.

---

## 사용자 프로필

- 이름: 하지훈
- 이메일: danihoonhoon@gmail.com
- 경험: 비개발자 — 첫 진지한 코딩 프로젝트
- 타깃 디바이스: iPhone (Safari)
- 다른 작업환경: VS Code, Antigravity, Xcode 가 깔린 다른 맥북 여러 대
- 선호: 빠른 결과, 최신 도구, 효율 우선

---

## 프로젝트 상태 스냅샷

### 완료
- [x] 음악·시각 파라미터 추출기 (`js/feature-extractor.js`)
- [x] Tone.js 생성 음악 엔진 (`js/music-engine.js`)
- [x] Three.js 절차적 3D 엔진 (`js/visual-engine.js`)
- [x] Aura Card 합성기 (`js/card-renderer.js`)
- [x] IndexedDB 저장소 (`js/card-storage.js`)
- [x] MindAR + Three.js AR 엔진 (`js/ar-engine.js`)
- [x] 3개 페이지 (`index/generate/play.html`) + 공통 CSS
- [x] PWA manifest + service worker
- [x] PWA 아이콘 (192/512)

### Claude Code 가 도와줄 단계
- [ ] 영구 폴더로 복사 (`~/Developer/aura-card`)
- [ ] git 초기화 + 첫 커밋
- [ ] GitHub 계정 연결 + 저장소 생성 + 푸시 (`gh` CLI)
- [ ] Cloudflare Pages 배포 안내
- [ ] iPhone Safari 검증

### 사용자 수동 단계 (CLI 로 자동화 불가)
- [ ] GitHub 계정 가입 (https://github.com/signup) — 한 번만
- [ ] Cloudflare Pages 대시보드에서 프로젝트 생성 — 한 번만
- [ ] PWA 첫 테스트 (홈 화면 추가)

---

## 사용자 원칙 (반드시 준수)

1. **효율 극대화** — 쓸모없는 대화·확인 금지
2. **위험 명령은 사전 확인** (`sudo`, `rm -rf`, `git push --force`, 전역 config 덮어쓰기 등)
3. **여러 Mac에서 이어 작업** — GitHub 가 단일 진실 원천
4. **최신 정보** — 외부 도구 변경 의심되면 짧게 검색 후 적용
5. **이미 깔린 도구 우선** (VS Code / Antigravity / Xcode / Homebrew)

---

## 기술 메모

### 의존성
- Tone.js 15, Three.js 0.160, MindAR 1.2.5 — **CDN 만 사용**, 빌드 도구 없음
- 정적 파일이라 Cloudflare Pages "Framework: None, Build: empty, Output: /" 로 충분

### iOS Safari 게이트
- 카메라/오디오 시작 = **사용자 제스처 후만** 가능 → `play-btn`, `ar-btn` 패턴
- 카메라 권한 매 페이지 로드마다 재요청 (Apple 정책)
- HTTPS 필수 (Cloudflare Pages 가 자동)

### IndexedDB 스키마
```
DB: aura-card-db
Store: cards (keyPath: "id")
Card 객체: { id, name, createdAt, features, params, cardImageBlob, sourcePhotoBlob, mindBuffer? }
```

### MindAR 컴파일
- 카드 PNG → `compileMindTarget()` (in-browser, 5~30초)
- 결과 ArrayBuffer 를 Blob 으로 IndexedDB 저장
- 재생 시 `URL.createObjectURL` → MindARThree 의 `imageTargetSrc`

### 결정성 (같은 사진 → 같은 결과)
- SHA-256 해시 → mulberry32 PRNG seed
- 모든 무작위 선택은 이 시드 기반

---

## 자주 막히는 곳

| 증상 | 원인 | 해결 |
|------|------|------|
| 음악이 안 나옴 | 사용자 제스처 전에 시작됨 | 클릭 후 `Tone.start()` |
| AR 카메라 검은 화면 | HTTPS 아님 | 배포 URL 사용 |
| AR 인식이 안 됨 | 카드가 너무 작거나 흐림 | 인쇄 또는 큰 모니터 |
| 컴파일이 너무 느림 | 카드가 너무 큼 | renderer 에서 SIZE 줄이기 |
| Service Worker 갱신 안 됨 | 캐시 이름 그대로 | `sw.js` 의 CACHE 버전 올리기 |

---

## 스타일 가이드

- 커밋: Conventional Commits — `feat:`, `fix:`, `docs:`, `chore:`, `style:`
- 브랜치: `main` 만 (1인 운영)
- 코드 주석: 한국어 OK, 왜를 설명
- 파일 크기 < 5MB (iOS Safari 메모리 친화)

---

**마지막 업데이트:** 2026-04-30 · Cowork 세션
