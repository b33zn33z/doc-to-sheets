# DataLens — Doc → Infographic Automator v2

Extract data from images & documents using Claude AI.
Auto-generates an infographic dashboard with charts, highlights & insights.
Data saved locally in browser — reload anytime from the Saved tab.

---

## What's new in v2

- **Auto image compression** — images resized before upload, stays under Vercel's 4.5 MB limit
- **Infographic dashboard** — key highlights, AI insights, auto chart (bar/pie/line)
- **Saved datasets** — all extractions saved to browser, reload anytime
- **Search/filter** — live search across the data table
- **Auto-navigate** — goes straight to dashboard after extraction

---

## Deploy to Vercel (Free) — 10 minutes

### 1. Get accounts

- **GitHub** (free): https://github.com
- **Vercel** (free): https://vercel.com/signup — sign up with GitHub
- **Anthropic API key** (free credits): https://console.anthropic.com → API Keys → Create

### 2. Upload to GitHub

1. Go to https://github.com/new → create new **private** repo
2. Upload all files — keep this exact structure:
   ```
   /api/extract.js
   /public/index.html
   /package.json
   /vercel.json
   /README.md
   ```

### 3. Deploy on Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repo → click **Deploy**
3. Wait ~30 seconds

### 4. Add API key (REQUIRED)

1. Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key (starts with `sk-ant-...`)
   - Check all 3 environments (Production, Preview, Development)
3. **Settings → Redeploy** to apply

### 5. (Optional) Add persistent storage with Vercel KV

By default, datasets are saved in the browser (localStorage). For server-side persistence shared across devices:

1. Vercel dashboard → your project → **Storage** tab
2. Create a **KV** store → Connect to project
3. Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars
4. Redeploy — data now persists on the server

---

## File size limits

| File type | Max size |
|-----------|----------|
| Images (auto-compressed) | ~3 MB each → compressed to ~500 KB |
| PDF / CSV / TXT | ~4 MB each |
| Total per upload batch | ~4 MB combined |

If you hit limits, upload files one at a time.

---

## Cost

- **Hosting**: Free on Vercel hobby plan
- **API**: ~$0.003–0.01 per extraction (very cheap)
- New Anthropic accounts get free credits to start
