import { Fragment, type ReactNode } from "react";
import p from "./page.module.css";

// 작품 본문은 아주 작은 문법만 지원한다: 빈 줄 = 문단, "## " = 소제목, "- " = 목록, URL 자동 링크.
// HTML은 해석하지 않는다(모두 텍스트로 이스케이프).

const URL_RE = /(https?:\/\/[^\s<>"')]+)/g;

function linkify(text: string): ReactNode {
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function Prose({ text }: { text: string }) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className={p.prose}>
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i}>{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{linkify(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {linkify(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
