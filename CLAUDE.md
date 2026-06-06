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

## Tech stack

- Next.js 14 Pages Router
- next-i18next v13
- Supabase (KV/data)
- Razorpay payments
- react-day-picker v10 with date-fns locales (hi, ta, te)
