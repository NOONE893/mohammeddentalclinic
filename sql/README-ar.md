# خطوات التشغيل

1. **قاعدة البيانات (مرة واحدة):** افتح Supabase ← SQL Editor ← الصق محتوى `ortho-and-vouchers.sql` ← Run.
   (إذا كان مشروعك على Lovable Cloud: الصقه في محادثة Lovable واطلب تنفيذه كـ Migration.)
2. **النشر على Vercel:** أضف Environment Variables:
   `VITE_SUPABASE_URL` و `VITE_SUPABASE_PUBLISHABLE_KEY` و `VITE_SUPABASE_PROJECT_ID`
   و `SUPABASE_URL` و `SUPABASE_PUBLISHABLE_KEY` (نفس قيم ملف .env)،
   وأضف أيضاً `NITRO_PRESET=vercel` لأن المشروع مضبوط افتراضياً على Cloudflare.
3. أمر البناء: `bun run build` (أو `npm run build`)، ثم ارفع.
