# Claude Code 첫 프롬프트 — aura-card 배포

복붙 한 번이면 GitHub + Cloudflare Pages 까지 끝낼 수 있게 짠 워크플로우.

---

## 1단계 · 영구 폴더로 복사

Mac 터미널에서:

```bash
mkdir -p ~/Developer
cp -R "/Users/hajihun/Library/Application Support/Claude/local-agent-mode-sessions/05fd2644-f074-45e2-8424-780c6d1fee4f/631c5e83-1a8d-4dae-a7b2-3104aa4e4ed1/local_481e780c-0c2a-4ae8-8f04-054b1b19f51a/outputs/aura-card" ~/Developer/aura-card
cd ~/Developer/aura-card
ls
```

---

## 2단계 · 로컬 빠른 확인 (선택, 30초)

```bash
npm run dev
# 브라우저: http://localhost:8000
# 사진 한 장 올려서 카드 생성 → 음악·3D 동작 확인
# Ctrl+C 로 종료
```

---

## 3단계 · Claude Code 실행

Claude Code 가 없다면:
```bash
curl -fsSL https://claude.ai/install.sh | sh
```

그리고:
```bash
cd ~/Developer/aura-card
claude
```

---

## 4단계 · 아래 프롬프트를 그대로 붙여넣기

```
CLAUDE.md 먼저 읽어줘.

목표: 이 프로젝트를 GitHub 에 올리고 Cloudflare Pages 자동 배포까지 마무리.
원칙: CLAUDE.md 의 "사용자 원칙" 5가지 모두 준수. 위험 명령은 무조건 사전 확인.

순서대로 진행:

[A. 환경 점검 — 한 번에]
1. `which brew git gh node npm && brew --version | head -1 && git --version && node -v` 실행해서 한 번에 표시.

[B. gh CLI 보장]
2. gh 가 없으면 `brew install gh` 제안 → 내 확인 받고 실행. 있으면 건너뜀.

[C. git 전역 설정 — 이미 있으면 건너뜀]
3. `git config --global user.name` 확인. 없으면 "하지훈" 으로 설정.
4. `git config --global user.email` 확인. 없으면 "danihoonhoon@gmail.com".
5. (이미 다른 값이면 덮어쓸지 물어보고만 진행)

[D. GitHub 계정]
6. `gh auth status` 실행. 미인증이면:
   - GitHub 계정 있는지 물어봐.
   - 없다면 https://github.com/signup 로 가입하고 알려달라고 대기.
   - 있으면 `gh auth login` 실행 (브라우저 인증).

[E. 저장소 + 첫 푸시]
7. `.git` 없으면 `git init -b main`.
8. `git add . && git commit -m "feat: aura-card v0.1 — photo to music+3D PWA"`.
9. `gh repo create aura-card --public --source=. --remote=origin --push` 실행.
10. 저장소 URL 표시.

[F. Cloudflare Pages 배포 안내]
11. https://pages.cloudflare.com 로 가라고 알려줘. 그리고 단계:
    - Create a project → Connect to Git → GitHub 인증
    - aura-card 선택
    - Framework preset: None / Build command: 비움 / Build output directory: /
    - Save and Deploy
    내가 "됐어" 할 때까지 대기.

[G. 배포 URL 받고 iPhone 테스트]
12. 사용자가 알려준 `https://aura-card-XXXX.pages.dev` URL 을 표시.
13. iPhone Safari 로 그 URL 을 열고:
    - generate.html 에서 사진 한 장 올려 카드 생성
    - 공유 링크 받아 다른 폰/탭에서 play.html 열기
    - "🎵 아우라 듣기" 누르면 음악 재생
    - "📷 AR 모드" 로 카드 PNG 비추면 3D 등장
    - "공유 → 홈 화면에 추가" 로 PWA 설치
    체크리스트 형태로 표시하고 사용자가 직접 OK/실패 마크.

[H. 마무리]
14. 다음에 다른 Mac 에서 이어서 작업하려면:
    `gh repo clone hajihun/aura-card && cd aura-card && npm run dev`
    이 한 줄이면 된다고 안내.

[규칙]
- sudo, rm, git push --force, 전역 config 덮어쓰기, brew uninstall 등은 실행 전 확인.
- 명령 출력은 짧게 요약. 풀 로그는 사용자가 요청할 때만.
- 한 단계가 실패하면 멈추고 사용자에게 보고. 무한 재시도 금지.
- 브라우저 단계는 사용자가 "다음" 할 때까지 대기.
```

---

## 자주 묻는 트러블슈팅

**Q. `gh auth login` 후에도 push 가 권한 거부되면?**
A. `gh auth refresh -h github.com -s write:org,repo` 한 번 실행.

**Q. Cloudflare Pages 가 빌드 실패한다면?**
A. Build settings 에서 Output directory 를 정확히 `/` 로 (점 없음). 빌드 명령은 완전히 비워야 함.

**Q. 다른 Mac 에서 첫 setup ?**
A. `brew install gh && gh auth login && gh repo clone hajihun/aura-card`. 끝.

**Q. PWA 가 iPhone 에서 설치 안 됨?**
A. Safari 로 열어야 함 (Chrome iOS 는 PWA 미지원). 공유 → 홈 화면에 추가.
