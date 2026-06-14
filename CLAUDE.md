# Vedayu Project Rules

## i18n — Translation Rule (STRICT)

Whenever you add a new key to any locale file, you MUST add the equivalent translation to ALL other locales in the same edit.

Locales: `en`, `hi`, `ta`, `te`
Files: `public/locales/{locale}/common.json`

**Never add a key to `en/common.json` without also adding it to `hi/common.json`, `ta/common.json`, and `te/common.json` in the same response.**

After any locale file edit, run:
```
python3 -c "
import json
with open('public/locales/en/common.json') as f: en = set(json.load(f).keys())
for loc in ['hi','ta','te']:
    d = set(json.load(open(f'public/locales/{loc}/common.json')).keys())
    missing = en - d
    if missing: print(f'{loc} MISSING: {sorted(missing)}')
    else: print(f'{loc}: ok')
"
```

If any locale is missing keys, add them before finishing.

## Order Capture — CRITICAL (Never Compromise)

Every customer order is real money and a real person waiting for their product. A lost order means a paid customer gets nothing and we have no record to act on. This is the highest-priority invariant in the codebase.

### Rules for any code that touches the payment/order flow:

1. **Save the order to Supabase (`orders` table) FIRST** — before sending emails, calling WhatsApp, firing Meta CAPI, or any other external service. The DB write is the only thing that cannot be skipped.

2. **Never put `orders.insert()` after external API calls.** External services (Resend, WhatsApp, Meta) can be slow or fail. Vercel serverless functions time out at 10s on Hobby. If the DB write is last in a long chain of awaits, it will get dropped when the function times out.

3. **Run secondary calls in parallel, not sequentially.** Use `Promise.allSettled([email, capi, whatsapp, push, ...])` so one slow service doesn't block the others or eat into the timeout budget.

4. **If `orders.insert()` itself fails, alert immediately** — send a push notification with the payment ID so the order can be manually recovered. Never silently swallow this error.

5. **The frontend must not redirect to order-confirmed if verify-payment failed.** Swallowing errors with `catch { /* redirect anyway */ }` hides failures. If the API returns a non-2xx or throws, surface it to the user instead of pretending success.

6. **Every payment method (prepaid, COD) must write to `orders` before returning a response.**

### What a lost order looks like (and costs):
- Customer paid via UPI/card → money left their account
- No email, no WhatsApp, no admin panel entry
- Customer has no order ID to track or follow up with
- We have no address to ship to
- Recovery requires manual Razorpay lookup + customer contact

This happened once (pay_T1PLAKLo0eVFhh, 2026-06-14) due to a Vercel timeout killing the function before `orders.insert()` was reached. The fix: order is now saved first. Do not regress this.

## Tech stack

- Next.js 14 Pages Router
- next-i18next v13
- Supabase (KV/data)
- Razorpay payments
- react-day-picker v10 with date-fns locales (hi, ta, te)
