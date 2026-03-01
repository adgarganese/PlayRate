# Supabase Security – Future / Pro Plan

Notes for when you upgrade to **Supabase Pro** (or better).

## Leaked password protection (HaveIBeenPwned)

- **What:** Supabase can check passwords against HaveIBeenPwned.org to block compromised passwords.
- **Why it’s off:** This feature requires the **Pro plan** (or above).
- **When you upgrade:** In the Dashboard go to **Authentication** → **Providers** (or **Authentication** → **Settings**) and enable **Leaked password protection** / **HaveIBeenPwned**.
- **Reference:** Supabase Auth security finding: “Leaked password protection is currently disabled.”
