# ACT · 선생님 작품 아카이브

선생님들이 만든 수업 도구, 업무 도구, 교실 놀이를 모으는 연구회 아카이브이자 포트폴리오. 운영 주소는 https://aict.app 이다.
원칙과 범위는 [CONSTITUTION.md](CONSTITUTION.md), 디자인은 [Figma · ACT Design System](https://www.figma.com/design/cx1yV50h131KN4obIpi76H)을 따른다.

## 스택

- Next.js 16 (App Router), React 19, TypeScript
- Cloudflare Workers에서 실행([OpenNext for Cloudflare](https://opennext.js.org/cloudflare))
- DB: Cloudflare D1 + Drizzle ORM. 마이그레이션은 `drizzle/`에 있다.
- 파일: Cloudflare R2(`act-uploads`). 썸네일은 Images 바인딩으로 16:10 WebP(1280/640) 두 장을 만들어 `/media/*`로 제공한다.
- 영상: 직접 올린 파일(MP4/MOV/WebM)은 90MB를 넘으면 올리는 브라우저에서 1080p 이하 MP4로 압축하고(`src/lib/video-compress.ts`, WebCodecs) `/media/video/*`로 Range 재생한다.
- 스타일: CSS Modules + `globals.css`의 디자인 토큰(Figma 변수와 1:1)

## 기능

| 영역 | 내용 |
|---|---|
| 둘러보기 | 홈, 작품 아카이브(유형·대상·교과 필터, 검색, 정렬, 페이지), 작품 상세(YouTube 임베드·직접 올린 영상 재생, 관련 작품), 제작자, 연구회 프로젝트, 소개 |
| 모바일 | 휴대폰으로 홈에 들어오면 게임 콘솔형 화면 `/arcade`로 이동한다. 웹 화면은 `/?web=1` |
| 제출 | `/submit`. 서버 검증, 개인정보 확인, 봇 방지(허니팟·속도 제한). 비회원 제출은 **개인 수정 링크**(`/edit/{token}`, 토큰은 해시로만 저장)를 발급한다 |
| 좋아요·즐겨찾기 | 작품별 좋아요·즐겨찾기 수 집계, `/favorites` |
| 운영진 | `/admin` — 운영진 권한이 있는 회원 계정 또는 공용 비밀번호(`ADMIN_PASSWORD`). 검수 대기·공개·숨김, 반려 메모, 직접 수정, 삭제, 프로젝트·제작자 관리, 링크 점검 |
| API | 회원 API 토큰으로 작품 등록 — [docs/api.md](docs/api.md) |
| 운영 | `sitemap.xml`, `robots.txt`, 보안 헤더 |

## 회원 로그인

- `/signup`: 아이디(영문·숫자·밑줄 4~24자, 대소문자 무시), 표시 이름, 비밀번호(12~128자)로 가입.
- `/login`: 아이디 로그인 또는 Google 로그인. 비밀번호는 salt가 있는 scrypt 해시로 저장하며 시도 횟수를 제한한다.
- `/account`: 내 작품 목록, 로그아웃, Google 계정 연결. 다른 회원에게 연결된 Google 계정은 가져오거나 병합할 수 없다.
- 로그인 후 제출한 작품은 계정에 저장된다. 비회원 제출은 수정 링크에서 계정으로 가져올 수 있고, 가져오면 그 링크는 즉시 폐기된다.
- 운영진 권한은 회원의 `is_admin` 플래그다. 운영진 회원이 `/account/settings`의 "운영진 권한"에서 부여·해제한다(자기 권한은 해제할 수 없다). 공용 비밀번호 세션으로는 권한을 바꾸지 않는다. 첫 운영진은 D1에서 직접 지정한다.
- 비밀번호 재설정, 계정 병합/연결 해제는 제공하지 않는다.

Google OAuth는 `openid profile email` 범위만 요청한다. 이메일은 Google이 확인한(`email_verified`) 경우에만 비공개로 저장하며 운영진의 회원 검색에만 쓴다. state·PKCE·nonce와 ID 토큰 서명/발급자/대상/만료를 검증하고, 공급자 토큰은 보관하지 않는다. 로그인 세션은 30일이며 DB에는 토큰 해시만 저장한다. 콜백은 `SITE_URL` + `/api/auth/callback/google`이다.

## 개발

키는 저장소에 두지 않는다. 시크릿은 Infisical `ACT` 프로젝트(`.infisical.json`)에서 실행할 때 주입한다.

```bash
npm install
npm run db:migrate:local     # 로컬 D1에 마이그레이션 적용
npm run dev                  # next dev — wrangler의 로컬 D1·R2 바인딩을 쓴다
```

스키마를 바꾸면 `npm run db:generate`로 `drizzle/`에 마이그레이션을 만든다. 검증은 `npm test`, `npm run typecheck`, `npm run lint`.

## 브랜치와 PR

- `main`: 운영 배포 기준. 직접 푸시할 수 없고 `develop`에서 오는 PR로만 합친다.
- `develop`: 기본 브랜치. 작업 브랜치의 PR은 여기로 보낸다.
- PR은 [CodeRabbit](https://coderabbit.ai)이 자동으로 리뷰한다(`.coderabbit.yaml`).

## 배포 (Cloudflare Workers)

```bash
npm run db:migrate:remote    # 스키마가 바뀌었을 때만
npm run deploy               # opennextjs-cloudflare build && deploy
```

Worker `act`, D1 `act-db`, R2 `act-uploads`, Images 바인딩은 `wrangler.jsonc`에 있다. 시크릿은 Infisical prod에서 `wrangler secret`으로 넣는다.


## 환경변수

`*` 표시는 Worker 시크릿(원본은 Infisical `ACT` prod)이다.

| 이름 | 설명 |
|---|---|
| `SITE_URL` | 공개 주소(`wrangler.jsonc`의 vars). 메타데이터·사이트맵·수정 링크·OAuth 콜백에 쓰인다 |
| `ADMIN_PASSWORD` * | 운영진 화면 공용 비밀번호 |
| `ADMIN_SECRET` * | 운영진 쿠키 서명 키 |
| `GOOGLE_CLIENT_ID` *, `GOOGLE_CLIENT_SECRET` * | Google OAuth 웹 클라이언트 |
