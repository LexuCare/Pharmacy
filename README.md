# RemyRx — AI Pharmacist Avatar Demo

A marketing-ready landing page featuring **Remy**, an AI health & skincare avatar. Patients land
on the page, describe their symptoms in plain language, and Remy recommends over-the-counter
products with usage tips — for healthcare, skincare, and general wellness.

Built with a tiny Node/Express backend that proxies **OpenAI** or **Anthropic** (your API key
stays on the server), plus a polished vanilla HTML/CSS/JS frontend.

## Features

- **Marketing landing page** — hero, social proof, "how it works", animated ROI metrics, feature grid, and CTAs.
- **Avatar chat** — a friendly avatar (floating launcher + hero card) opens a chat where the patient describes symptoms and gets tailored recommendations.
- **OpenAI _or_ Anthropic** — switch providers with one env var.
- **Safety-first prompt** — OTC-only recommendations, emergency awareness, and clear "not medical advice" disclaimers.
- **Works without a key** — ships with a realistic demo fallback so you can preview the experience instantly.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) add your API key
cp .env.example .env
#    then edit .env and set AI_PROVIDER + the matching key

# 3. Run
npm start
```

Open http://localhost:3000 and click **Talk to Remy** (or the floating avatar, bottom-right).

> No API key? The demo still runs using built-in canned responses, so you can show the full flow.

## Configuration (`.env`)

| Variable            | Description                                  | Default                      |
| ------------------- | -------------------------------------------- | ---------------------------- |
| `AI_PROVIDER`       | `openai` or `anthropic`                      | `openai`                     |
| `OPENAI_API_KEY`    | OpenAI key (if using OpenAI)                 | —                            |
| `OPENAI_MODEL`      | OpenAI model                                 | `gpt-4o-mini`                |
| `ANTHROPIC_API_KEY` | Anthropic key (if using Anthropic)           | —                            |
| `ANTHROPIC_MODEL`   | Anthropic model                              | `claude-3-5-sonnet-latest`   |
| `PORT`              | Server port                                  | `3000`                       |

## How it works

```
Patient (browser)  ──►  POST /api/chat  ──►  Express server  ──►  OpenAI / Anthropic
       ▲                                                              │
       └──────────────  recommendation (markdown rendered)  ◄─────────┘
```

The server holds the system prompt that turns the model into "Remy" and keeps your API key off the client.

## Project structure

```
pharma_demo/
├── server.js          # Express server + /api/chat (OpenAI/Anthropic/demo)
├── package.json
├── .env.example
└── public/
    ├── index.html     # Landing page + chat modal
    ├── styles.css      # Design system / layout
    ├── app.js          # Chat logic, markdown rendering, ROI counters
    └── avatar.png      # Remy's avatar
```

## Deploy for free (Render)

The app is already production-ready (it binds to `process.env.PORT`). The easiest free host is **Render**.

1. **Put the code on GitHub** (from the `pharma_demo` folder):
   ```bash
   git init
   git add .
   git commit -m "Pharma demo"
   git branch -M main
   git remote add origin https://github.com/<you>/pharma-demo.git
   git push -u origin main
   ```
   > `.env` is git-ignored, so your API key is NOT pushed — good.

2. **Create the service on Render**
   - Go to [render.com](https://render.com) → **New +** → **Blueprint** → select your repo (it reads `render.yaml`).
   - Or use **New + → Web Service** manually with: Build `npm install`, Start `npm start`.

3. **Add your secret** in the Render dashboard → Environment:
   - `ANTHROPIC_API_KEY` = your key
   - (`AI_PROVIDER=anthropic` and `ANTHROPIC_MODEL=claude-sonnet-4-6` come from `render.yaml`)

4. **Deploy.** You'll get a public `https://pharma-demo.onrender.com` URL.

**Note on the free tier:** the service sleeps after ~15 min idle, so the first request after a nap takes ~30–50s to wake (then it's fast). Voice input/output works because Render serves over HTTPS.

### Other free options
- **Railway** / **Fly.io** — same idea: connect repo, set `ANTHROPIC_API_KEY`, start with `npm start`.
- **Vercel** — works but needs a serverless adapter for Express; Render is simpler for this app.

## Disclaimer

This is a **demo**, not a medical device. Remy provides general wellness information only and is
not a substitute for professional medical advice, diagnosis, or treatment.
