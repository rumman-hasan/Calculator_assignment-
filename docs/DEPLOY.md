# Putting ThumbStop online (GitHub, Netlify, Supabase)

Do `docs/SETUP-BANGLA.md` first and confirm it works on your PC. Everything here is free-tier.

## 1. GitHub
1. Create a **private** repository named `thumbstop` on github.com.
2. Upload the project folder (GitHub Desktop is easiest: File > Add local repository > Publish). `.env.local` and `node_modules` are ignored automatically. Never upload your keys.

## 2. Netlify
1. netlify.com > Add new site > Import from GitHub > choose `thumbstop`.
2. Build command `npm run build` (already in `netlify.toml`). Leave publish directory empty; Netlify detects Next.js.
3. Site settings > Environment variables > add: `NEXT_PUBLIC_SITE_URL` (your Netlify address, no trailing slash), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_SALT`.
4. Deploy. If the build fails, copy the error text and send it for a fix.

## 3. Tell Supabase the new address
Authentication > URL Configuration: set Site URL to your Netlify address and add Redirect URLs `https://YOUR-SITE/auth/callback` and `https://YOUR-SITE/auth/confirm`.
Keep "Allow new users to sign up" OFF.

## 4. After it is live
Run `docs/TESTING-CHECKLIST.md` on the live site. A custom domain can be added later in Netlify (Domain management); ask before any paid upgrade.
