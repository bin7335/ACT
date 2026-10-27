import type { MetadataRoute } from "next";
import { listMakers, listProjects, listPublishedSlugs } from "@/lib/content/queries";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [works, makers, projects] = await Promise.all([listPublishedSlugs(), listMakers(), listProjects()]);
  const u = (path: string) => `${site.url}${path}`;
  return [
    { url: u("/"), changeFrequency: "daily", priority: 1 },
    { url: u("/works"), changeFrequency: "daily", priority: 0.9 },
    { url: u("/makers"), changeFrequency: "weekly" },
    { url: u("/projects"), changeFrequency: "weekly" },
    { url: u("/about"), changeFrequency: "monthly" },
    ...works.map((w) => ({ url: u(`/works/${w.slug}`), lastModified: w.updatedAt, priority: 0.8 })),
    ...makers.map((m) => ({ url: u(`/makers/${m.slug}`) })),
    ...projects.map((p) => ({ url: u(`/projects/${p.slug}`) })),
  ];
}
