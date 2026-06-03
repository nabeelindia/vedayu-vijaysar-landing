import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BASE_URL = 'https://vedayulife.com';

function generateSitemap(staticPages, blogPosts) {
  const staticEntries = staticPages.map(({ url, lastmod, changefreq, priority }) => `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

  const blogEntries = blogPosts.map(post => `
  <url>
    <loc>${BASE_URL}/blog/${post.slug}</loc>
    <lastmod>${post.lastModified || post.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <!-- Blog index -->
  <url>
    <loc>${BASE_URL}/blog</loc>
    <lastmod>2026-05-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
${blogEntries}
${staticEntries}
</urlset>`;
}

export default function SitemapXml() {
  // getServerSideProps handles the response — this component never renders
  return null;
}

export async function getServerSideProps({ res }) {
  const CONTENT_DIR = path.join(process.cwd(), 'content/blog');
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.mdx'));
  const blogPosts = files.map(file => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { data } = matter(raw);
    return { slug: data.slug || file.replace(/\.mdx$/, ''), date: data.date, lastModified: data.lastModified };
  });

  const staticPages = [
    { url: `${BASE_URL}/`,               lastmod: '2026-05-19', changefreq: 'weekly',  priority: '1.0' },
    { url: `${BASE_URL}/contact`,        lastmod: '2026-05-19', changefreq: 'monthly', priority: '0.4' },
    { url: `${BASE_URL}/privacy`,        lastmod: '2026-05-19', changefreq: 'yearly',  priority: '0.2' },
    { url: `${BASE_URL}/terms`,          lastmod: '2026-05-19', changefreq: 'yearly',  priority: '0.2' },
    { url: `${BASE_URL}/refund-policy`,  lastmod: '2026-05-19', changefreq: 'yearly',  priority: '0.2' },
    { url: `${BASE_URL}/shipping-policy`, lastmod: '2026-05-19', changefreq: 'yearly',  priority: '0.2' },
  ];

  const sitemap = generateSitemap(staticPages, blogPosts);

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.write(sitemap);
  res.end();

  return { props: {} };
}
