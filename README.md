# ACT · 선생님 작품 아카이브

선생님들이 만든 수업 도구, 업무 도구, 교실 놀이를 모으는 연구회 아카이브이자 포트폴리오.
원칙과 범위는 [CONSTITUTION.md](CONSTITUTION.md), 디자인은 [Figma · ACT Design System](https://www.figma.com/design/cx1yV50h131KN4obIpi76H)을 따른다.

## 스택

- Next.js 16 (App Router, Cache Components), React 19, TypeScript
- SQLite (better-sqlite3) + Drizzle ORM — 마이그레이션은 서버 시작 시 자동 적용
- 썸네일: sharp로 16:10 WebP(1280/640) 변환 후 `DATA_DIR/uploads`에 저장, `/media/*`로 제공
- 스타일: CSS Modules + `globals.css`의 디자인 토큰(Figma 변수와 1:1)

## 기능

| 영역 | 내용 |
|---|---|
| 둘러보기 | 홈, 작품 아카이브(유형·대상·교과 필터, 검색, 정렬, 페이지), 작품 상세(YouTube 임베드, 관련 작품), 제작자, 연구회 프로젝트, 소개 |
| 제출 | 로그인 없이 `/submit`. 서버 검증, 개인정보 확인, 봇 방지(허니팟·속도 제한). 제출 후 **개인 수정 링크** 발급(`/edit/{token}`, 토큰은 해시로만 저장) |
| 즐겨찾기 | 브라우저(localStorage)에 저장, `/favorites` |
| 운영진 | `/admin` — 운영진 권한이 있는 회원 계정 또는 공용 비밀번호(`ADMIN_PASSWORD`). 검수 대기·공개·숨김, 반려 메모, 직접 수정, 삭제, 프로젝트·제작자 관리, 링크 점검 |
| 운영 | `sitemap.xml`, `robots.txt`, 보안 헤더, 링크 점검 스크립트 |

## 회원 로그인

- `/signup`: 아이디(영문·숫자·밑줄 4~24자, 대소문자 무시), 표시 이름, 비밀번호(12~128자)로 가입.
- `/login`: 아이디 로그인 또는 Google 로그인. 비밀번호는 salt가 있는 scrypt 해시로 저장하며 시도 횟수를 제한한다.
- `/account`: 내 작품 목록, 로그아웃, Google 계정 연결. 아이디 회원은 현재 비밀번호를 재확인하고 Google 계정을 연결한다. 다른 회원에게 연결된 Google 계정은 가져오거나 병합할 수 없다.
- 로그인 후 제출한 작품은 계정에 저장된다. 비회원 제출은 유지하며 기존 수정 링크에서 계정으로 가져오면 해당 링크는 즉시 폐기된다.
- 운영진 권한은 회원의 `is_admin` 플래그다. 회원가입만으로는 얻지 않는다. 운영진 회원은 `/account/settings`의 "운영진 권한"에서 회원을 이름·아이디·Google 이메일로 검색해 권한을 부여·해제한다(자기 권한은 해제할 수 없다). 공용 비밀번호 접속은 그대로 유지하되, 비밀번호 세션으로는 권한을 바꾸지 않는다.
- 첫 운영진은 운영 DB에서 직접 지정한다: `update member set is_admin = 1 where id = ...`.
- 비밀번호 재설정, 계정 병합/연결 해제, 즐겨찾기 서버 동기화는 제공하지 않는다.

### Google OAuth 운영 설정

Infisical `ACT`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SITE_URL`을 사용한다. 키는 파일로 만들지 않는다.
`SITE_URL`은 로그인에 사용할 대표 origin이다(개발: `http://localhost:3000`, 운영: HTTPS). Google 로그인/연결은 대표 주소에서 시작해야 한다. 도메인 이전 시 `SITE_URL`과 Google Console 콜백을 함께 맞추며, 기존 도메인은 대표 도메인으로 리디렉션한다. 쿠키는 호스트별로 분리된다.

2026-11-06 `ACT Web`에 localhost와 아래 두 원본/콜백이 등록됨:
- `https://act.aura-board.com` → `/api/auth/callback/google`
- `https://aict.app` → `/api/auth/callback/google`

요청 범위는 `openid profile email`이다. 이메일은 Google이 확인한(`email_verified`) 경우에만 비공개로 저장하며, 운영진의 회원 검색에만 쓴다. OAuth state·PKCE·nonce, ID 토큰 서명/발급자/대상/만료를 검증한다. 공급자 access/refresh token은 보관하지 않는다. 로그인 세션은 30일이며 DB에는 토큰 해시만 저장한다. Google 연결 요청은 시작 시점 세션에 묶이며 로그아웃/계정 변경 시 실패한다.

배포 전에 영구 DB를 백업한다. 시작 시 Drizzle 마이그레이션이 회원·Google 연결·세션·일회성 OAuth 테이블을 추가한다. 기존 작품은 보존한다. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`로 검증할 수 있다.

## 개발

키는 로컬에도 저장소에도 두지 않는다. 모두 Infisical `ACT` 프로젝트(`.infisical.json`)에서 실행할 때 주입한다.

```bash
npm install
infisical login              # 처음 한 번
npm run db:seed              # 예시 데이터 (./data/act.db)
npm run dev                  # infisical run --env=dev -- next dev
```

스키마를 바꾸면 `npm run db:generate`로 `drizzle/`에 마이그레이션을 만든다.

## 배포 (testauram VM)

1. VM에서 소스를 받아 `npm ci && npm run build` — better-sqlite3·sharp가 네이티브 모듈이라 **VM(리눅스)에서 빌드**한다.
2. `.next/standalone` 폴더를 서비스 디렉터리(예: `/opt/act/current`)로 옮긴다. 정적 파일과 `drizzle/`은 빌드 스크립트가 함께 넣어 둔다.
3. `deploy/act.service`를 VM 경로에 맞춰 설치. 시크릿은 Infisical에서 주입하고, `DATA_DIR`은 영구 디렉터리로 둔다.
4. Cloudflare에서 쓰는 도메인의 서브도메인을 Tunnel로 `127.0.0.1:3100`에 연결한다. 도메인을 바꾸면 `SITE_URL`만 수정한다.
5. 링크 점검은 `deploy/act-check-links.timer`로 매일 실행한다.

백업 대상은 `DATA_DIR` 하나(`act.db`, `uploads/`)다. SQLite는 WAL 모드이므로 `sqlite3 act.db ".backup ..."`으로 떠 둔다.

## 환경변수

`*` 표시는 Infisical `ACT` 프로젝트(dev / prod)에 있는 키다. 나머지는 실행 환경에서 지정하는 일반 설정이다.

| 이름 | 설명 |
|---|---|
| `SITE_URL` * | 공개 주소. 메타데이터·사이트맵·수정 링크에 쓰인다 (prod 값은 도메인 확정 후 등록) |
| `DATA_DIR` | DB와 업로드 이미지 디렉터리 (기본 `./data`) |
| `MIGRATIONS_DIR` | 마이그레이션 폴더 (기본 `./drizzle`) |
| `ADMIN_PASSWORD` * | 운영진 화면 비밀번호 |
| `ADMIN_SECRET` * | 운영진 쿠키 서명 키 |
| `GOOGLE_CLIENT_ID` *, `GOOGLE_CLIENT_SECRET` * | Google OAuth 웹 클라이언트 "ACT Web" (GCP My First Project). 콜백은 `SITE_URL` + `/api/auth/callback/google` |
| `PORT`, `HOSTNAME` | standalone 서버 바인딩 |
