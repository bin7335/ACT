import { sql } from "drizzle-orm";

/** D1의 바인드 변수 100개 제한을 피하도록 문자열 목록을 JSON 변수 하나로 전달한다.
 * inArray(column, textList(values)) 형태로 사용하며, 값은 SQL 문자열에 직접 삽입하지 않는다.
 */
export function textList(values: readonly string[]) {
  return sql`(select value from json_each(${JSON.stringify(values)}))`;
}
