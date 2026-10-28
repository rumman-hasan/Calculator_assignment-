# ThumbStop সেটআপ গাইড (বাংলা)

এই গাইড শেষ করলে আপনি নিজের ইমেইল আর পাসওয়ার্ড দিয়ে `/admin`-এ লগইন করতে পারবেন।
সময় লাগবে প্রায় ১৫ মিনিট। সব কাজ বিনামূল্যে।

> একটা জিনিস মনে রাখুন: Supabase-এর `service_role` কী আর `.env.local` ফাইল কাউকে দেবেন না, কোথাও আপলোডও করবেন না।

---

## ধাপ ১: Supabase অ্যাকাউন্ট ও প্রজেক্ট

1. https://supabase.com এ গিয়ে **Start your project** চাপুন এবং GitHub বা ইমেইল দিয়ে সাইন আপ করুন।
2. **New project** চাপুন।
   - **Name:** `thumbstop`
   - **Database Password:** একটি শক্ত পাসওয়ার্ড দিন এবং কোথাও লিখে রাখুন।
   - **Region:** Singapore (বাংলাদেশের সবচেয়ে কাছে)।
3. **Create new project** চাপুন। তৈরি হতে ১-২ মিনিট লাগে।

## ধাপ ২: ডাটাবেস টেবিল তৈরি

প্রতিটি ফাইল **আলাদা New query**-তে, **ক্রমানুসারে** চালাবেন (১, ২, ৩):

1. Supabase-এর বাঁ মেনু থেকে **SQL Editor** → **New query**।
2. VS Code-এ `supabase/migrations/20261020000001_init_schema.sql` খুলুন। `Ctrl + A`, `Ctrl + C`। SQL Editor-এ পেস্ট করে **Run**। **Success** এলে ঠিক আছে।
3. নতুন query: `20261020000002_seed.sql` একইভাবে চালান।
4. নতুন query: `20261025000003_roles_portal_finance.sql` একইভাবে চালান। (এটি Designer role, ক্লায়েন্ট পোর্টাল, নতুন ইনভয়েস নিয়ম ও নিরাপত্তা যোগ করে।)

কোনো ফাইল দুইবার চালাবেন না। Error এলে error-এর লেখাটি কপি করে আমাকে পাঠান।

## ধাপ ৩: কী (key) কপি করে `.env.local` ফাইল বানানো

1. Supabase-এ **Project Settings** (গিয়ার আইকন) → **API** খুলুন।
2. VS Code-এ `.env.example` ফাইলে রাইট-ক্লিক করে **Copy**, তারপর ফাঁকা জায়গায় রাইট-ক্লিক করে **Paste** করুন। নতুন ফাইলটির নাম বদলে `.env.local` রাখুন।
3. `.env.local` খুলে এই চারটি লাইন বদলান:

```
NEXT_PUBLIC_SUPABASE_URL=         ← "Project URL" এর লেখা
NEXT_PUBLIC_SUPABASE_ANON_KEY=    ← "anon public" কী
SUPABASE_SERVICE_ROLE_KEY=        ← "service_role" কী ("Reveal" চেপে দেখুন)
RATE_LIMIT_SALT=                  ← যেকোনো লম্বা এলোমেলো লেখা, যেমন: x8Kd92LmQp7ZvT3wNe41
```

`=` এর পরে কোনো ফাঁকা বা উদ্ধৃতি চিহ্ন (") দেবেন না। ফাইল Save করুন (`Ctrl + S`)।

## ধাপ ৪: লগইনের ঠিকানা সেট করা

1. Supabase-এ **Authentication** → **URL Configuration** খুলুন।
2. **Site URL** এ লিখুন: `http://localhost:3000`
3. **Redirect URLs** এ **Add URL** চেপে লিখুন: `http://localhost:3000/auth/callback`। Save করুন।
4. **Authentication** → **Sign In / Providers** (বা **Settings**) এ গিয়ে **Allow new users to sign up** **বন্ধ (OFF)** করুন। এটা জরুরি: এতে বাইরের কেউ নিজে অ্যাকাউন্ট খুলতে পারবে না। অ্যাকাউন্ট শুধু আপনি (Owner) বানাবেন।
5. একই জায়গায় **Email** provider-এ **Email OTP Expiration** বাড়িয়ে `86400` (২৪ ঘণ্টা) করুন, যাতে ক্লায়েন্টকে পাঠানো "পাসওয়ার্ড সেট করুন" লিংক সহজে মেয়াদ না হারায়।
6. Redirect URLs-এ `http://localhost:3000/auth/confirm` ও যোগ করুন।

## ধাপ ৫: সাইট চালু করা

VS Code-এর টার্মিনালে (`Ctrl + ~`) চালান:

```
npm install
npm run dev
```

`.env.local` বদলালে সাইট বন্ধ করে (`Ctrl + C`) আবার `npm run dev` চালাতে হবে।
ব্রাউজারে http://localhost:3000/login খুলুন। ফর্ম এখন চালু থাকা উচিত।

## ধাপ ৬: প্রথম Owner অ্যাকাউন্ট বানানো

ওয়েবসাইটে রেজিস্ট্রেশন নেই, তাই প্রথম Owner আপনি Supabase থেকে বানাবেন (একবারই):

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**। আপনার ইমেইল ও একটি শক্ত পাসওয়ার্ড দিন, **Auto Confirm User** টিক দিন।
2. **SQL Editor** → **New query** এ লিখে (ইমেইলটি আপনারটি দিন) **Run** করুন:

```sql
update public.profiles set role = 'admin' where lower(email) = lower('আপনার-ইমেইল@example.com');
```

3. `Success. 1 row affected`-এর মতো কিছু দেখাবে। না দেখালে ইমেইল ভুল।
4. http://localhost:3000/login এ লগইন করুন। আপনি `/admin`-এ যাবেন।

### ম্যানেজার, ডিজাইনার বা ক্লায়েন্ট যোগ করা
- **ম্যানেজার / ডিজাইনার:** Admin → **Users & Roles** → নাম, ইমেইল, role দিন। একটি এককালীন লিংক পাবেন, WhatsApp বাটনে পাঠিয়ে দিন। সে লিংকে ঢুকে নিজের পাসওয়ার্ড বানাবে।
- **ক্লায়েন্ট:** Admin → **Clients** → ক্লায়েন্ট খুলে **Create portal login**। একইভাবে লিংক পাবেন।
- লিংকটি শুধু একবার দেখানো হয়। হারালে **Renew link** চাপুন।

## ধাপ ৭: প্রথম কাজগুলো

- **Website Settings:** ফোন, ইমেইল, ঠিকানা, ফেসবুক লিংক ঠিক করুন।
- **Services & Packages:** সার্ভিসের লেখা আর প্রাইস প্যাকেজ দিন। প্রাইস ফাঁকা থাকলে সাইটে “Price on request” দেখায়।
- **Portfolio & Reviews:** শুধু আসল কাজ আর আসল রিভিউ দিন। Publish টিক না দিলে সাইটে আসে না।
- **Clients → Projects → Invoices:** ক্লায়েন্ট যোগ করে প্রজেক্ট আর ইনভয়েস বানান। হাতে টাকা পেলে ইনভয়েসে payment রেকর্ড করুন।

## সমস্যা হলে

| সমস্যা | কারণ ও সমাধান |
|---|---|
| লগইন ফর্ম ধূসর/বন্ধ | `.env.local` ফাইল নেই, নামে ভুল আছে বা মান বসেনি। ঠিক করে সাইট বন্ধ করে আবার `npm run dev` চালান। |
| “Invalid email or password” | ইমেইল/পাসওয়ার্ড ভুল। Confirm email চালু থাকলে আগে ইমেইলের লিংকে ক্লিক করুন। |
| লগইনের পর `/admin` না গিয়ে `/portal` এ যায় | আপনার role এখনো `client`। ধাপ ৬-এর SQL ঠিকমতো চালান। |
| "পাসওয়ার্ড সেট" লিংক কাজ করে না | মেয়াদ শেষ। Clients/Users পেজে **Renew link** চাপুন। |
| Contact form: “Enquiry saving is not set up yet” | `SUPABASE_SERVICE_ROLE_KEY` বসেনি। |
| ছবি আপলোড হচ্ছে না | ধাপ ২-এর প্রথম SQL ফাইলটি পুরো চালানো হয়নি (storage অংশ বাদ গেছে)। |

## এখনো তৈরি হয়নি (সৎভাবে)

- **অনলাইন পেমেন্ট:** ইচ্ছা করেই নেই। শুধু হাতে (ক্যাশ, ব্যাংক, bKash/Nagad) পেমেন্ট রেকর্ড হয়।
- **ইমেইল পাঠানো:** সাইট থেকে ইমেইল যায় না (Phase 2)। ইনভয়েস/লিংক WhatsApp বা আপনার নিজের ইমেইল অ্যাপ দিয়ে পাঠান।
- **Google Analytics, Facebook Pixel, Google Maps, পোর্টফোলিওতে YouTube/Vimeo এমবেড:** এখনো বানানো হয়নি।
- **ব্লগ ও বাংলা ভাষা:** Phase 3।
- **ইনভয়েস PDF-এ বাংলা অক্ষর:** `?` দেখায়। বাংলা লাগলে ইনভয়েস পেজের **Print** চেপে "Save as PDF" করুন।
