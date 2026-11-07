import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, type LookupFunction } from "node:net";
import { MAX_UPLOAD_BYTES } from "./uploads";

// 작품 링크의 대표 이미지(og:image, YouTube 썸네일)를 가져온다.
// 사용자가 넣은 주소를 서버가 여는 것이므로 내부망·루프백 등으로는 연결하지 않는다.
// DNS 응답마다 검사하고 그 주소로만 연결해 리디렉션·DNS 재바인딩도 막는다.

const UA = "ACT-Thumbnail/1.0 (+teacher archive)";
const HTML_MAX = 512 * 1024;
const DEADLINE_MS = 10_000;

const blocked = new BlockList();
for (const [net, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3]] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [["::", 127], ["64:ff9b::", 96], ["100::", 64], ["2001::", 23], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) blocked.addSubnet(net, prefix, "ipv6");

export function isBlockedAddress(address: string, family: 4 | 6) {
  return blocked.check(address, family === 6 ? "ipv6" : "ipv4");
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    if (!addresses.length || addresses.some(a => isBlockedAddress(a.address, a.family as 4 | 6))) return callback(new Error("blocked address"), "", 0);
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

type Fetched = { body: Buffer; type: string; url: URL };

function get(url: URL, maxBytes: number, truncate: boolean, deadline: number, redirects = 3): Promise<Fetched> {
  if (!/^https?:$/.test(url.protocol) || (url.port && url.port !== "80" && url.port !== "443") || url.username || url.password) {
    return Promise.reject(new Error("unsupported url"));
  }
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).get(url, { lookup: guardedLookup, timeout: 5000, headers: { "User-Agent": UA, Accept: "text/html,image/*;q=0.9,*/*;q=0.5" } }, res => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error("too many redirects"));
        return get(new URL(res.headers.location, url), maxBytes, truncate, deadline, redirects - 1).then(resolve, reject);
      }
      if (status !== 200) {
        res.resume();
        return reject(new Error(`status ${status}`));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      const done = () => resolve({ body: Buffer.concat(chunks), type: String(res.headers["content-type"] ?? "").toLowerCase(), url });
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size <= maxBytes) return void chunks.push(chunk);
        if (truncate) {
          done();
          req.destroy();
        } else req.destroy(new Error("too large"));
      });
      res.on("end", done);
      res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(new Error("deadline")), Math.max(0, deadline - Date.now()));
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

const META_KEYS = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];

/** HTML에서 대표 이미지 주소를 찾는다. 상대 경로는 페이지 주소 기준으로 푼다. */
export function findImageUrl(html: string, base: URL): URL | null {
  const tags = html.slice(0, HTML_MAX).match(/<meta\b[^>]*>/gi) ?? [];
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"))?.slice(1).find(v => v !== undefined);
  for (const key of META_KEYS) {
    for (const tag of tags) {
      if ((attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase() !== key) continue;
      const content = attr(tag, "content")?.trim().replace(/&amp;/g, "&");
      if (!content) continue;
      try {
        const url = new URL(content, base);
        if (url.protocol === "https:" || url.protocol === "http:") return url;
      } catch {}
    }
  }
  return null;
}

export function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

/** 링크의 대표 이미지 바이트를 돌려준다. 찾지 못하면 null. 연결 실패·차단은 예외로 던진다. */
export async function fetchLinkImage(link: string): Promise<Buffer | null> {
  const deadline = Date.now() + DEADLINE_MS;
  const yt = youtubeId(link);
  let image: URL | null = yt && /^[\w-]{6,20}$/.test(yt) ? new URL(`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`) : null;
  if (!image) {
    const page = await get(new URL(link), HTML_MAX, true, deadline);
    if (!/text\/html|application\/xhtml\+xml/.test(page.type)) return null;
    image = findImageUrl(page.body.toString("utf8"), page.url);
  }
  if (!image) return null;
  const res = await get(image, MAX_UPLOAD_BYTES, false, deadline);
  return res.type.startsWith("image/") ? res.body : null;
}
