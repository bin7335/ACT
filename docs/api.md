# ACT 작품 등록 API

에이전트나 스크립트가 회원 계정으로 작품을 등록할 때 쓰는 API입니다.
토큰은 **계정 설정 → API 토큰**에서 만들고, 만든 직후 한 번만 표시됩니다.

- 기본 주소: `https://aict.app`
- 인증: `Authorization: Bearer <토큰>` (토큰은 `act_`로 시작)
- 응답: JSON, `Cache-Control: no-store`

## 권한에 따른 상태

| 토큰 소유자 | 등록 결과 |
|---|---|
| 운영진(관리자) 회원 | `published` — 검수 없이 즉시 공개 |
| 일반 회원 | `review` — 운영진 검수 뒤 공개 |

## 작품 등록

`POST /api/works`

### 요청 본문

| 필드 | 필수 | 설명 |
|---|---|---|
| `purpose` | ✅ | `class`(수업 도구) · `work`(업무 도구) · `play`(교실 놀이) · `other`(기타) |
| `type` | ✅ | `web-app` · `mobile-app` · `video` · `material` · `other`(기타) |
| `title` | ✅ | 2~40자 |
| `summary` | ✅ | 5~80자 |
| `link` | ✅ | 작품 주소. YouTube·앱스토어 주소는 링크 종류를 자동으로 판별합니다 |
| `body` | | 상세 설명, 5000자 이내. `## `로 소제목, `- `로 목록 |
| `makers` | | 쉼표로 구분한 이름. 없으면 토큰 소유자 이름 |
| `audience` | | 배열. `유아` · `초등 저` · `초등 중` · `초등 고` · `중등` |
| `subjects` | | 배열 또는 쉼표 문자열. 최대 5개 |
| `project` | | 연구회 프로젝트 slug (선택). 관리자와 연구회회원의 토큰에서만 반영된다. |
| `thumbnailAlt` | | 이미지 설명, 120자 이내 |
| `contactEmail` | | 연락받을 이메일 (공개되지 않음) |

썸네일을 따로 올리지 않아도, 링크의 대표 이미지를 자동으로 가져옵니다.

### 예시

```bash
curl -X POST https://aict.app/api/works \
  -H "Authorization: Bearer act_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "purpose": "class",
    "type": "web-app",
    "title": "분수 피자 나누기",
    "summary": "피자를 나눠 보며 분수의 크기를 비교하는 교실용 웹앱",
    "link": "https://example.com/fraction-pizza",
    "body": "## 만든 이유\n학생들이 분수를 어려워해서 만들었습니다.\n\n## 사용 방법\n모둠별로 한 대씩 열어 주세요.",
    "audience": ["초등 중"],
    "subjects": ["수학"],
    "makers": "김하늘"
  }'
```

```json
// 201 Created
{
  "slug": "a1b2c3d4",
  "status": "published",
  "url": "/works/a1b2c3d4",
  "message": "작품을 바로 공개했어요."
}
```

### 오류

| 상태 | 의미 | 본문 |
|---|---|---|
| `401` | 토큰이 없거나 유효하지 않음 | `{ "error": "..." }` |
| `400` | 본문 형식 오류 또는 검증 실패 | `{ "error": "...", "fields": { "title": "..." } }` |
| `429` | 한 회원이 시간당 30건을 넘김 | `{ "error": "..." }` |

## 운영 메모

- 토큰 원문은 저장하지 않고 SHA-256 해시만 보관합니다. 잃어버리면 폐기하고 새로 만드세요.
- 회원당 토큰은 최대 5개입니다.
- 폐기하면 즉시 무효가 됩니다. 계정이 삭제되면 토큰도 함께 사라집니다.
