# ACT · 선생님 작품 아카이브

선생님들이 만든 웹 도구, 웹앱, 모바일 앱, 영상, 수업 자료를 모으는 연구회 아카이브이자 포트폴리오.
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
| 운영진 | `/admin` — 공용 비밀번호(`ADMIN_PASSWORD`). 검수 대기·공개·숨김, 반려 메모, 직접 수정, 삭제, 프로젝트·제작자 관리, 링크 점검 |
| 운영 | `sitemap.xml`, `robots.txt`, 보안 헤더, 링크 점검 스크립트 |

회원 로그인은 추후 도입한다. 작품 테이블의 `owner_id`가 그 자리다.

## 개발

```bash
npm install
cp .env.example .env.local   # ADMIN_PASSWORD, ADMIN_SECRET 채우기 (SITE_URL=http://localhost:3000)
npm run db:seed              # 예시 데이터 (./data/act.db)
npm run dev
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

| 이름 | 설명 |
|---|---|
| `SITE_URL` | 공개 주소. 메타데이터·사이트맵·수정 링크에 쓰인다 |
| `DATA_DIR` | DB와 업로드 이미지 디렉터리 (기본 `./data`) |
| `MIGRATIONS_DIR` | 마이그레이션 폴더 (기본 `./drizzle`) |
| `ADMIN_PASSWORD` | 운영진 화면 비밀번호 |
| `ADMIN_SECRET` | 운영진 쿠키 서명 키 (운영 필수) |
| `PORT`, `HOSTNAME` | standalone 서버 바인딩 |
