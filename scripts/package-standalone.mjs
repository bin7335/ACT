// next build 뒤 standalone 폴더에 정적 파일·마이그레이션을 복사한다.
// 결과물 .next/standalone 하나만 VM 서비스 디렉터리로 옮기면 실행된다.
import fs from "node:fs";

const out = ".next/standalone";
if (!fs.existsSync(out)) throw new Error("먼저 next build를 실행하세요 (output: standalone).");
fs.cpSync(".next/static", `${out}/.next/static`, { recursive: true });
if (fs.existsSync("public")) fs.cpSync("public", `${out}/public`, { recursive: true });
fs.cpSync("drizzle", `${out}/drizzle`, { recursive: true });
console.log("standalone ready:", out);
