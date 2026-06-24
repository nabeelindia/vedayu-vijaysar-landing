# Retailer Availability Badges — Design Spec

**Date:** 2026-06-24  
**Status:** Approved

## Context

Vedayu Vijaysar Glass is now sold on Amazon.in and at D-Mart stores. Surfacing this on the landing page builds credibility ("if Amazon stocks it, it's legitimate"), reduces skepticism, and gives hesitant buyers a zero-risk verification path. This is a trust/social-proof feature, not a sales-diversion feature.

## Design Decisions

- **Amazon** → clickable link to `https://www.amazon.in/dp/B0H6BKLB51/` (opens in new tab)
- **D-Mart** → informational only, no link (D-Mart has no public per-product URLs; the badge signals "you can verify this in-store")
- **Logos** → SVG files saved in `/public/images/` (no external CDN dependency)
- **Placement** → two touches for maximum impressions (see below)

## Two-Touch Placement Strategy

### Touch 1 — Hero badge row (100% of visitors)
Appears immediately below the existing `badge-row` (Ayurveda / Free Delivery / COD).  
A thin divider with "Also available on" label separates it from the trust badges above.  
Both logos rendered as `<img>` tags with a white pill border.

### Touch 2 — Below pricing cards (peak purchase intent)
A strip rendered inside the pricing `<section>`, after the 3 pack cards, before the checkout form.  
Label: "Prefer shopping on another platform?"  
Amazon pill is an `<a>` tag; D-Mart pill is a `<div>`.

## Logo Files

| File | Description |
|------|-------------|
| `/public/images/logo-amazon.svg` | Dark wordmark + orange smile arrow |
| `/public/images/logo-dmart.svg` | All dark-green wordmark with pyramid-star icon |

## i18n

No new locale keys needed — the labels ("Also available on", "Prefer shopping on another platform?", "stores near you") are short enough to hard-code in English for now, or added to all 4 locales (en/hi/ta/te) if i18n is desired later. Not in scope for this implementation.

## Verification

1. Run `npm run dev`, open `localhost:3000`
2. Hero: confirm retailer row appears below the COD badge
3. Click Amazon badge → opens `amazon.in/dp/B0H6BKLB51/` in new tab
4. D-Mart badge → not clickable, cursor remains default
5. Pricing section: confirm strip appears after Pack of 5 card, before the checkout form
6. Mobile: check both placements wrap gracefully on narrow viewports
