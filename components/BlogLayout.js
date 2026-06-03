import Head from 'next/head';
import Link from 'next/link';
import SiteFooter from './SiteFooter';
import RelatedPosts from './RelatedPosts';

export default function BlogLayout({ meta, children, allPosts = [] }) {
  const {
    title, description, date, lastModified,
    author, image, slug, readTime,
  } = meta;

  const fullUrl   = `https://vedayulife.com/blog/${slug}`;
  const fullImage = image?.startsWith('http') ? image : `https://vedayulife.com${image}`;
  const dateFormatted = new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    image: fullImage,
    author: { '@type': 'Organization', name: author || 'Vedayu Wellness Team', url: 'https://vedayulife.com' },
    publisher: {
      '@type': 'Organization',
      name: 'Vedayu',
      logo: { '@type': 'ImageObject', url: 'https://vedayulife.com/favicon.svg' },
    },
    datePublished: date,
    dateModified: lastModified || date,
    mainEntityOfPage: { '@type': 'WebPage', '@id': fullUrl },
    url: fullUrl,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: 'https://vedayulife.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blog',  item: 'https://vedayulife.com/blog' },
      { '@type': 'ListItem', position: 3, name: title,   item: fullUrl },
    ],
  };

  return (
    <>
      <Head>
        <title>{title} | Vedayu</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={fullUrl} />

        {/* Open Graph */}
        <meta property="og:type"        content="article" />
        <meta property="og:title"       content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image"       content={fullImage} />
        <meta property="og:url"         content={fullUrl} />
        <meta property="og:site_name"   content="Vedayu" />
        <meta property="article:published_time" content={date} />
        <meta property="article:modified_time"  content={lastModified || date} />

        {/* Twitter */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image"       content={fullImage} />

        {/* Schema */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      </Head>

      {/* ── Nav ── */}
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

      {/* ── Hero ── */}
      <div style={{ background: '#FFF8EE', borderBottom: '1px solid #e8ddd0', padding: '40px 24px 32px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <p style={{ fontSize: '.78rem', color: '#9e8060', marginBottom: 16 }}>
            <Link href="/" style={{ color: '#9e8060', textDecoration: 'none' }}>Home</Link>
            {' → '}
            <Link href="/blog" style={{ color: '#9e8060', textDecoration: 'none' }}>Blog</Link>
            {' → '}
            <span style={{ color: '#5C3D1E' }}>{title}</span>
          </p>

          <h1 style={{
            fontFamily: 'Georgia,serif', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            color: '#3D2610', lineHeight: 1.3, marginBottom: 16,
          }}>
            {title}
          </h1>

          <p style={{ color: '#7a6045', fontSize: '.9rem', marginBottom: 0, lineHeight: 1.6 }}>
            {description}
          </p>

          <div style={{ marginTop: 16, fontSize: '.78rem', color: '#9e8060', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span>✍️ {author || 'Vedayu Wellness Team'}</span>
            <span>📅 {dateFormatted}</span>
            {readTime && <span>⏱ {readTime}</span>}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 60px' }}>
        <article className="blog-content">
          {children}
        </article>

        {/* ── CTA Box ── */}
        <div style={{
          background: 'linear-gradient(135deg, #5C3D1E 0%, #7a5028 100%)',
          borderRadius: 12, padding: '28px 32px', marginTop: 48, textAlign: 'center',
        }}>
          <p style={{ color: '#C9A84C', fontSize: '.8rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', margin: '0 0 8px' }}>
            🌿 Vedayu Vijaysar Wooden Glass
          </p>
          <h3 style={{ color: '#fff', fontSize: '1.3rem', margin: '0 0 10px', fontFamily: 'Georgia,serif' }}>
            Start Your Daily Wellness Ritual
          </h3>
          <p style={{ color: 'rgba(255,255,255,.8)', fontSize: '.88rem', margin: '0 0 20px', lineHeight: 1.6 }}>
            Handcrafted from authentic Vijaysar wood · Free delivery all over India · COD available
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" style={{
              background: '#C9A84C', color: '#3D2610', textDecoration: 'none',
              padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: '.9rem',
            }}>
              Buy Now — From ₹499 →
            </Link>
            <Link href="/" style={{
              background: 'transparent', color: '#fff', textDecoration: 'none',
              padding: '12px 28px', borderRadius: 8, fontWeight: 600, fontSize: '.9rem',
              border: '1px solid rgba(255,255,255,.4)',
            }}>
              View All Packs
            </Link>
          </div>
        </div>

        {/* ── Related Posts ── */}
        <RelatedPosts allPosts={allPosts} currentSlug={slug} />

        {/* ── Back to blog ── */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link href="/blog" style={{ color: '#5C3D1E', fontSize: '.85rem', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Blog
          </Link>
        </div>
      </div>

      <SiteFooter />

      <style>{`
        .blog-content { color: #3D2610; font-size: 1rem; line-height: 1.85; }
        .blog-content h2 { font-family: Georgia,serif; font-size: 1.35rem; color: #3D2610; margin: 2rem 0 .75rem; border-bottom: 2px solid #e8ddd0; padding-bottom: .4rem; }
        .blog-content h3 { font-family: Georgia,serif; font-size: 1.1rem; color: #5C3D1E; margin: 1.5rem 0 .5rem; }
        .blog-content p  { margin: 0 0 1.2rem; }
        .blog-content ul, .blog-content ol { padding-left: 1.5rem; margin: 0 0 1.2rem; }
        .blog-content li { margin-bottom: .5rem; }
        .blog-content strong { color: #3D2610; }
        .blog-content a  { color: #5C3D1E; font-weight: 600; }
        .blog-content a:hover { color: #C9A84C; }
        .blog-content hr { border: none; border-top: 1px solid #e8ddd0; margin: 2rem 0; }
        .blog-content blockquote { border-left: 3px solid #C9A84C; padding: 12px 20px; background: #FFF8EE; margin: 1.5rem 0; border-radius: 0 8px 8px 0; font-style: italic; color: #5C3D1E; }
        .blog-content blockquote p { margin: 0; }
        .blog-content table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: .9rem; }
        .blog-content th { background: #5C3D1E; color: #fff; padding: 10px 14px; text-align: left; }
        .blog-content td { padding: 9px 14px; border-bottom: 1px solid #e8ddd0; }
        .blog-content tr:nth-child(even) td { background: #FFF8EE; }
        @media (max-width: 600px) {
          .blog-content h2 { font-size: 1.2rem; }
          .blog-content { font-size: .95rem; }
        }
      `}</style>
    </>
  );
}
