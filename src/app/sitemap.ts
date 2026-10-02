import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://www.getonshows.com";

export const revalidate = 3600;

/**
 * Every published profile becomes an indexable page: /p/[id] carries full
 * OpenGraph metadata, so these URLs are the site's long-tail SEO surface
 * for "podcast guest on X" style discovery.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,updated_at")
    .eq("state", "published")
    .order("updated_at", { ascending: false })
    .limit(5000);
  const profiles = (data ?? []) as { id: string; updated_at: string }[];

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...profiles.map((p) => ({
      url: `${SITE_URL}/p/${p.id}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
