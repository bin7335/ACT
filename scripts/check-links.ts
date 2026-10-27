// 공개 작품 링크 점검. VM cron에서 하루 한 번 실행한다.
// 사용: npm run check-links   (DATA_DIR 환경변수로 DB 위치 지정)
import { checkLinks } from "../src/lib/content/link-check";

checkLinks()
  .then((r) => {
    console.log(`[check-links] checked=${r.checked} broken=${r.broken}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error("[check-links] failed", e);
    process.exit(1);
  });
