import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Head from 'next/head';
import Link from 'next/link';
import SiteFooter from '../../components/SiteFooter';

const CONTENT_DIR = path.join(process.cwd(), 'content/blog');

export default function BlogIndex({ posts }) {
  return (
    <>
      <Head>
        <title>Ayurvedic Wellness Blog — Vedayu</title>
        <meta name="description" content="Explore Vedayu's Ayurvedic wellness blog — guides on Vijaysar wood, blood sugar wellness, morning rituals, and the ancient wisdom of Ayurveda." />
        <link rel="canonical" href="https://vedayulife.com/blog" />
        <meta property="og:title" content="Ayurvedic Wellness Blog — Vedayu" />
        <meta property="og:description" content="Explore Vedayu's Ayurvedic wellness blog — guides on Vijaysar wood, blood sugar wellness, morning rituals, and the ancient wisdom of Ayurveda." />
        <meta property="og:url" content="https://vedayulife.com/blog" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://vedayulife.com/images/og-image.jpg" />
      </Head>

      {/* Nav */}
      <nav style={{
        background: '#fff', borderBottom: '1px solid #e8ddd0',
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: '1.2rem', color: '#5C3D1E', letterSpacing: 1 }}>
            VEDAYU
          </span>
          <span style={{ fontSize: '.75rem', color: '#9e8060', borderLeft: '1px solid #d4b896', paddingLeft: 10 }}>
            Ayurvedic Wellness
          </span>
        </Link>
        <Link href="/" style={{
          background: '#5C3D1E', color: '#fff', textDecoration: 'none',
          padding: '8px 18px', borderRadius: 6, fontSize: '.82rem', fontWeight: 600,
        }}>
          🛒 Shop Now
        </Link>
      </nav>

      {/* Hero */}
      <div style={{ background: '#FFF8EE', borderBottom: '1px solid #e8ddd0', padding: '48px 24px 40px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '.78rem', color: '#9e8060', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
            Vedayu Wellness Blog
          </p>
          <h1 style={{
            fontFamily: 'Georgia,serif', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            color: '#3D2610', lineHeight: 1.3, marginBottom: 12,
          }}>
            Ayurvedic Wisdom for Everyday Life
          </h1>
          <p style={{ color: '#7a6045', fontSize: '.95rem', maxWidth: 520, margin: '0 auto' }}>
            Guides on Vijaysar wood, blood sugar wellness, morning rituals, and the ancient traditions of Ayurveda.
          </p>
        </div>
      </div>

      {/* Posts grid */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 72px' }}>
        <div style={{ display: 'grid', gap: 28 }}>
          {posts.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: 'none' }}
            >
              <article style={{
                background: '#fff', border: '1px solid #e8ddd0', borderRadius: 12,
                padding: '28px 32px', display: 'flex', gap: 28, alignItems: 'flex-start',
                transition: 'box-shadow .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(92,61,30,.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {post.image && (
                  <img
                    src={post.image}
                    alt={post.title}
                    style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                  />
                )}
                <div>
                  <h2 style={{
                    fontFamily: 'Georgia,serif', fontSize: '1.15rem', color: '#3D2610',
                    margin: '0 0 8px', lineHeight: 1.35,
                  }}>
                    {post.title}
                  </h2>
                  <p style={{ color: '#7a6045', fontSize: '.88rem', margin: '0 0 14px', lineHeight: 1.6 }}>
                    {post.description}
                  </p>
                  <div style={{ fontSize: '.75rem', color: '#9e8060', display: 'flex', gap: 16 }}>
                    <span>✍️ {post.author || 'Vedayu Wellness Team'}</span>
                    {post.readTime && <span>⏱ {post.readTime}</span>}
                    <span style={{ color: '#C9A84C', fontWeight: 600 }}>Read →</span>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>

      <SiteFooter />
    </>
  );
}

export async function getStaticProps() {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.mdx'));
  const posts = files
    .map(file => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
      const { data } = matter(raw);
      return { ...data, slug: data.slug || file.replace(/\.mdx$/, '') };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return { props: { posts } };
}
