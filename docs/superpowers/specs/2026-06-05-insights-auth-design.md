# Insights Page — Password Protection

**Date:** 2026-06-05  
**Status:** Approved

## Goal

Protect `/insights` (and all sub-routes) behind a password so only the admin can access analytics, WhatsApp conversations, and future sensitive data.

## Approach

Next.js Middleware intercepts every request to `/insights*` at the edge. If a valid signed session cookie is absent, the request is redirected to `/insights/login`. On successful login an httpOnly signed cookie is set for 7 days.

## Architecture

### New files

| File | Purpose |
|------|---------|
| `middleware.js` | Edge check: validates `insights_session` cookie on all `/insights*` routes, redirects to `/insights/login` if invalid |
| `pages/insights/login.js` | Branded login page — Vedayu green, logo mark, password input, submit button |
| `pages/api/insights-auth.js` | POST: validate password → set cookie. GET: clear cookie (logout) |

### Moved file

| From | To |
|------|----|
| `pages/insights.js` | `pages/insights/index.js` |

No logic changes to the insights page itself.

### Environment variables

| Var | Purpose |
|-----|---------|
| `INSIGHTS_PASSWORD` | The password to enter on the login screen |
| `SESSION_SECRET` | Random 32+ char string used to sign the cookie (prevents forgery) |

Both must be added to `.env.local` and Vercel environment variables.

## Auth Flow

1. User visits `/insights`
2. Middleware checks for `insights_session` cookie
3. Cookie missing or invalid → redirect to `/insights/login`
4. User enters password → POST `/api/insights-auth`
5. API compares against `INSIGHTS_PASSWORD` (constant-time compare to prevent timing attacks)
6. Match → set signed httpOnly `insights_session` cookie (7-day expiry) → redirect to `/insights`
7. No match → return 401, show error on login page
8. Logout → GET `/api/insights-auth?logout=1` → clears cookie → redirect to `/insights/login`

## Login Page Design

- Vedayu green (`#4A7C59`) color scheme
- Centered card on a light background (`#f5f5f5`)
- Logo mark / "Vedayu" wordmark at top
- Single password input (type=password)
- "Unlock" submit button in Vedayu green
- Error message shown inline on wrong password
- No username field — password only

## Cookie Signing

Use `jose` (already available as a Next.js peer dep) or a simple HMAC-SHA256 with Node's built-in `crypto` module to sign a payload of `{ exp: Date.now() + 7days }`. Middleware verifies the signature and expiry on every request. No DB lookup needed.

## Security Notes

- Cookie is `httpOnly` (JS can't read it) and `SameSite=Strict`
- Password comparison uses `crypto.timingSafeEqual` to prevent timing attacks
- `SESSION_SECRET` rotation invalidates all existing sessions immediately
- No rate limiting needed for a personal admin page (obscurity + strong password is sufficient)

## Success Criteria

- [ ] `/insights` redirects to `/insights/login` when no valid cookie
- [ ] Correct password sets cookie and lands on `/insights`
- [ ] Wrong password shows error, stays on login page
- [ ] Cookie persists 7 days across browser restarts
- [ ] Logout clears cookie and redirects to login
- [ ] All existing insights functionality unchanged
