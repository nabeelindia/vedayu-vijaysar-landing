import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { serialize } from 'next-mdx-remote/serialize';
import { MDXRemote } from 'next-mdx-remote';
import BlogLayout from '../../components/BlogLayout';

const CONTENT_DIR = path.join(process.cwd(), 'content/blog');

export default function BlogPost({ source, meta, allPosts }) {
  return (
    <BlogLayout meta={meta} allPosts={allPosts}>
      <MDXRemote {...source} />
    </BlogLayout>
  );
}

export async function getStaticPaths() {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.mdx'));
  const paths = files.map(file => ({
    params: { slug: file.replace(/\.mdx$/, '') },
  }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const filePath = path.join(CONTENT_DIR, `${params.slug}.mdx`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const { content, data: meta } = matter(raw);
  const source = await serialize(content);

  // All posts for Related Posts section (excluding current)
  const allFiles = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.mdx'));
  const allPosts = allFiles.map(file => {
    const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
    return {
      slug: data.slug || file.replace(/\.mdx$/, ''),
      title: data.title,
      image: data.image || null,
      readTime: data.readTime || null,
    };
  });

  return { props: { source, meta, allPosts } };
}
