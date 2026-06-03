/**
 * /api/cron/generate-posts
 *
 * Vercel Cron endpoint — runs every Monday at 6 AM IST (0:30 UTC).
 * 1. Fetches the list of already-published blog slugs from GitHub.
 * 2. Picks the next 2 unpublished topics from TOPIC_QUEUE.
 * 3. Calls Anthropic Claude to generate full MDX for each.
 * 4. Commits both files to GitHub → triggers Vercel auto-deploy.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY   — Claude API key
 *   GITHUB_TOKEN        — Personal access token (repo write access)
 *   CRON_SECRET         — Random secret, set in Vercel env vars
 */

import Anthropic from '@anthropic-ai/sdk';
import { TOPIC_QUEUE } from '../../../lib/blog-topics';

export const config = { maxDuration: 300 };

const GITHUB_OWNER = 'nabeelindia';
const GITHUB_REPO  = 'vedayu-vijaysar-landing';
const CONTENT_PATH = 'content/blog';
const TODAY        = new Date().toISOString().split('T')[0];

// ── GitHub helpers ────────────────────────────────────────────────────────────

async function githubGet(path) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub GET ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

async function githubCommit(filePath, content, message) {
  // Check if file already exists (need SHA to update)
  let sha;
  try {
    const existing = await githubGet(filePath);
    sha = existing.sha;
  } catch (_) {
    // File doesn't exist — that's fine, create new
  }

  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT ${filePath} → ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Claude content generator ──────────────────────────────────────────────────

async function generatePostMDX(topic) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are a senior content writer for Vedayu, an Ayurvedic wellness brand that sells the Vijaysar Wooden Glass — a traditional drinking vessel handcrafted from Pterocarpus marsupium heartwood. The glass retails from ₹499 and ships free across India with Cash on Delivery.

BRAND VOICE:
- Warm, trustworthy, knowledgeable about Ayurveda
- Honest — never overclaim health benefits
- Respect traditional knowledge while being balanced about what is proven vs. traditional use
- Indian audience — use ₹ for prices, reference Indian geography and culture naturally
- Never use words like "miracle", "cure", "proven to treat", or "clinically proven" for the glass

CONTENT RULES:
- Write in clean MDX (Markdown with JSX support — but use plain Markdown only, no JSX components)
- Include a prominent disclaimer section near the end
- Always include a "Buy" section before the disclaimer that links to / using [→ Order Vijaysar Wooden Glass — Free Delivery](/)
- Use H2 (##) for main sections, H3 (###) for subsections
- Include at least one comparison table where relevant
- Include a blockquote for important caveats using > syntax
- Minimum 900 words of body content

OUTPUT FORMAT:
Return ONLY the raw MDX content starting from the frontmatter (---). Do not wrap in code blocks. Do not add any preamble.

FRONTMATTER FIELDS (fill all):
---
title: "..."
description: "..."
date: "${TODAY}"
lastModified: "${TODAY}"
author: "Vedayu Wellness Team"
image: "PLACEHOLDER_IMAGE"
slug: "PLACEHOLDER_SLUG"
readTime: "PLACEHOLDER_READTIME"
---`;

  const userPrompt = `Write a full blog post for Vedayu with these parameters:

Title: ${topic.title}
Meta description: ${topic.description}
Primary keyword to naturally weave in: "${topic.primaryKeyword}"
Editorial angle: ${topic.angle}
Target read time: ${topic.readTime}
Image: ${topic.image}
Slug: ${topic.slug}

Replace the PLACEHOLDER values in the frontmatter with the correct values from above.

Structure the article with:
1. A strong opening paragraph (no heading) that hooks the reader
2. 4-6 H2 sections covering the topic thoroughly
3. At least one practical list or table
4. One blockquote callout for an important caveat or Ayurvedic concept
5. A "Buy Vijaysar Wooden Glass" H2 section with 2-3 lines and the buy link
6. A final "⚠️ Important Disclaimer" or "⚠️ Disclaimer" section using blockquote or plain paragraphs

Make it genuinely useful and informative. Aim for ${topic.readTime.split(' ')[0]} minutes of reading.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 3000,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  return message.content[0].text;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Verify Vercel cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const errors = [];

  try {
    // 1. Get already-published slugs from GitHub
    const existingFiles = await githubGet(CONTENT_PATH);
    const publishedSlugs = new Set(
      existingFiles.map(f => f.name.replace(/\.mdx$/, ''))
    );
    log.push(`Found ${publishedSlugs.size} existing posts`);

    // 2. Pick next 2 unpublished topics
    const pending = TOPIC_QUEUE.filter(t => !publishedSlugs.has(t.slug));
    if (pending.length === 0) {
      return res.status(200).json({ message: 'All topics published — add more to TOPIC_QUEUE', log });
    }

    const toGenerate = pending.slice(0, 2);
    log.push(`Generating: ${toGenerate.map(t => t.slug).join(', ')}`);

    // 3. Generate both posts in parallel
    const generated = await Promise.all(
      toGenerate.map(async (topic) => {
        try {
          const mdx = await generatePostMDX(topic);
          return { topic, mdx, ok: true };
        } catch (err) {
          errors.push(`Generate ${topic.slug}: ${err.message}`);
          return { topic, ok: false };
        }
      })
    );

    // 4. Commit successful posts to GitHub
    for (const item of generated) {
      if (!item.ok) continue;
      try {
        await githubCommit(
          `${CONTENT_PATH}/${item.topic.slug}.mdx`,
          item.mdx,
          `blog: auto-generate "${item.topic.title}"`
        );
        log.push(`Committed ${item.topic.slug}.mdx`);
      } catch (err) {
        errors.push(`Commit ${item.topic.slug}: ${err.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      generated: generated.filter(i => i.ok).map(i => i.topic.slug),
      log,
      errors,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, log, errors });
  }
}
