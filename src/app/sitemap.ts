import type { MetadataRoute } from "next";
import { listMakers, listPublishedSlugs } from "@/lib/content/queries";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 연구회 프로젝트는 연구회회원 전용이라 넣지 않는다.
  const [works, makers] = await Promise.all([listPublishedSlugs(), listMakers()]);
  const u = (path: string) => `${site.url}${path}`;
  return [
    { url: u("/works"), changeFrequency: "daily", priority: 1 },
    { url: u("/landing"), changeFrequency: "monthly", priority: 0.7 },
    { url: u("/makers"), changeFrequency: "weekly" },
    { url: u("/about"), changeFrequency: "monthly" },
    ...works.map((w) => ({ url: u(`/works/${w.slug}`), lastModified: w.updatedAt, priority: 0.8 })),
    ...makers.map((m) => ({ url: u(`/makers/${m.slug}`) })),
  ];
}
