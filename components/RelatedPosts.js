import Link from 'next/link';

export default function RelatedPosts({ allPosts, currentSlug }) {
  const related = allPosts
    .filter(p => p.slug !== currentSlug)
    .slice(0, 2);

  if (!related.length) return null;

  return (
    <div style={{ marginTop: 48, borderTop: '2px solid #e8ddd0', paddingTop: 32 }}>
      <h2 style={{
        fontFamily: 'Georgia,serif', fontSize: '1.15rem', color: '#3D2610',
        margin: '0 0 20px',
      }}>
        Continue Reading
      </h2>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {related.map(post => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              border: '1px solid #e8ddd0', borderRadius: 10, overflow: 'hidden',
              transition: 'box-shadow .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(92,61,30,.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              {post.image && (
                <img
                  src={post.image}
                  alt={post.title}
                  style={{ width: '100%', height: 130, objectFit: 'cover' }}
                />
              )}
              <div style={{ padding: '14px 16px' }}>
                <p style={{
                  fontFamily: 'Georgia,serif', fontSize: '.95rem', color: '#3D2610',
                  margin: '0 0 6px', lineHeight: 1.35, fontWeight: 600,
                }}>
                  {post.title}
                </p>
                <p style={{ margin: 0, fontSize: '.75rem', color: '#C9A84C', fontWeight: 600 }}>
                  Read article →
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
