import { MetadataRoute } from 'next';

// Only publicly crawlable, unauthenticated pages belong here. Everything
// behind ProtectedShell (dashboard, scanner, github, jira, upload,
// onboarding) requires a signed-in session — indexing them just sends
// crawlers to a login redirect, which is a Lighthouse SEO/crawl-budget
// smell, not a real page for search engines to rank. Keep this in sync
// with public/robots.txt's Disallow list.
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://patchline.ai';

  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/login', priority: 0.5, changeFrequency: 'monthly' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date().toISOString(),
    changeFrequency,
    priority,
  }));
}
