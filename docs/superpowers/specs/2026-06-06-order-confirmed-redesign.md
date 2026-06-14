# Order Confirmation Page Redesign

**Date:** 2026-06-06  
**Status:** Approved

## Goal

Replace the current narrow single-column card layout with a responsive, mobile-first design that uses the full desktop viewport and makes post-purchase offers impossible to miss on mobile.

## Layout

### Mobile (< 768px) — single column

Top to bottom:

1. **Full-width success banner** (green gradient) — icon, "Order Placed!" / "Payment Successful!", name, order ID pill with copy button
2. **Info strip** — 3 inline facts: Free delivery · Ships within 24 hrs · WhatsApp support
3. **Order Summary card** — receipt rows (product, pack, amount, dispatch, delivery, support)
4. **Miswak teaser row** — collapsed green strip: 🎁 "Free gift waiting for you!" + subtitle + ↓ chevron. Tapping scrolls to full offer card.
5. **Referral teaser row** — collapsed gold strip: 🤝 "Give ₹50 off to a friend!" + ↓ chevron. Tapping scrolls to referral card.
6. **Miswak upsell card** (full, existing design — image, pills, shipping note, CTA, decline link)
7. **Referral card** (existing design — WhatsApp share button)
8. **How to Use card** — numbered steps
9. **CTA buttons** — WhatsApp tracking, Back to Home
10. **Disclaimer**
11. **Sticky bottom bar** (pinned, z-index above content) — always visible while page has scrollable content; hides once miswak offer is accepted/declined

### Desktop (≥ 768px) — two columns, max-width 1100px

- **Left column (flex: 1):** Success banner (full-width, spans both cols via negative margin or grid), then Order Summary card + How to Use card
- **Right column (380px, sticky top: 24px):** Miswak upsell card + Referral card + CTA buttons + Disclaimer
- Info strip spans full width between banner and two-column body
- No sticky bar on desktop (offer is always visible in right column)

## Sticky Bottom Bar (mobile only)

- Fixed to bottom of viewport
- Background: `linear-gradient(135deg, #2d6b40, #4A7C59)`
- Left: 🎁 bold headline + subtext in white
- Right: white pill button "Claim ↓"
- Tapping scrolls to `#miswak-upsell` section
- Hides when `miswakState === 'done' || miswakState === 'declined'` (offer resolved)
- Hidden on desktop via CSS media query

## Teaser Rows (mobile only)

Two slim clickable strips between Order Summary and the full offer cards:

- **Miswak teaser:** green-tinted background, border `#4A7C59`, scrolls to `#miswak-upsell` on tap
- **Referral teaser:** gold-tinted background, border `#C9A84C`, scrolls to `#referral-share` on tap
- Hidden on desktop (offers always visible in right column)

## Success Banner

- Full-width, always (both mobile and desktop)
- Spans the full grid on desktop via `grid-column: 1 / -1`
- Text: `t('order_confirmed.order_placed_title')` / `t('order_confirmed.payment_success_title')`
- Subtext: `t('order_confirmed.banner_subtitle', { name })` — e.g. "Your order is confirmed and being prepared."
- Order ID pill: ID in monospace + Copy button inline (replaces separate Order ID box below)

## Info Strip

- Full-width white bar below banner
- 3 facts: Free delivery · Dispatch (dynamic: "Ships within 24 hrs" or scheduled date) · WhatsApp support
- Wraps gracefully on narrow screens

## Removed / Relocated

- The floating miswak/referral teaser pills that previously appeared above the order ID box are removed — replaced by the teaser rows and sticky bar
- The separate Order ID box is removed — order ID is now in the banner pill
- The COD payment instruction ("Keep ₹499 ready…") is removed from the banner — it was redundant with the Amount row in the order summary

## i18n

New keys needed (all 4 locales — en/hi/ta/te):

- `order_confirmed.banner_subtitle` — "Your order is confirmed and being prepared."
- `order_confirmed.info_dispatch` — used in info strip for dispatch fact
- `order_confirmed.miswak_teaser_cta` — "Free gift waiting for you!" (teaser row title, already exists as `miswak_teaser_title`)
- `order_confirmed.referral_teaser_cta` — reuse `referral_teaser_title`

Existing keys cover everything else.

## Implementation Notes

- Use CSS Grid for the two-column desktop layout (`grid-template-columns: 1fr 380px`)
- The sticky bar is a fixed-position `<div>` rendered only when `miswakState !== 'done' && miswakState !== 'declined'`, hidden on desktop via `@media (min-width: 768px) { display: none }`
- Teaser rows use `scrollIntoView` (already used in the current page for the same purpose)
- Right column uses `position: sticky; top: 24px; align-self: start` so it doesn't scroll away on long pages
- Remove the `confirm-card` wrapper div and `confirm-page` wrapper — replace with the new grid structure
- Keep all existing state logic (`miswakState`, `copied`, `custMobile`, etc.) unchanged
- Keep all existing analytics events unchanged
