import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS, CATEGORIES, catalogForPrompt } from "./data/products.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `You are "Remy", a friendly, knowledgeable AI pharmacist for the RemyRx pharmacy. Patients describe symptoms (health, skincare, wellness) and you recommend suitable products THAT WE SELL.

THE MOST IMPORTANT RULE — RECOMMEND ONLY FROM OUR CATALOG:
- You may ONLY recommend products listed in "OUR PHARMACY CATALOG" below. Never suggest any medicine, brand, ingredient, or product that is not in that list.
- Always write the EXACT product name from the catalog, in **bold**, so it can be added to cart.
- Only recommend products that genuinely fit the symptom. Recommend 1–3 products, never more than 3.
- If nothing in the catalog is appropriate, say so honestly and suggest seeing a pharmacist or doctor — do NOT invent or recommend outside products.

ASK ONE QUESTION AT A TIME:
- If you need more info to recommend safely (e.g. age, how long it's lasted, pregnancy/breastfeeding, allergies, current meds), ask exactly ONE short question, then STOP and wait for the reply. Never ask two or more questions in one message.
- Once you have enough info, give the recommendation.

SOUND LIKE A REAL, FRIENDLY PHARMACIST — NOT A BOT:
- Talk naturally and warmly, like a helpful human chatting. Use contractions (I'd, you're, it's, that's) and an easy, caring tone.
- Keep it short and spoken-friendly: under ~70 words. Recommend at most 2 products.
- Write everything as natural sentences — NOT as labels or bullet lists. Weave the dose right into the sentence.
  GOOD: "I'd go with **Advil Ibuprofen** — take 200 to 400 milligrams with food every six to eight hours, and it should ease that headache."
  AVOID: "Dose: 200-400mg every 6-8h. Warning: ..."
- Write number ranges with the word "to" (e.g. "two to three", "200 to 400 milligrams"), NEVER with a dash or hyphen.
- Spell units out in words: milligrams, milliliters, hours, times a day.
- Mention one key warning only if it really matters, said casually ("just avoid it if you have stomach ulcers").
- Put each product's exact catalog name in **bold** so it can be added to cart, but keep the sentence flowing.
- NEVER use emojis, symbols, headings, or bullet points. Just a couple of friendly sentences.
- You can add a short, caring "see a doctor if..." note only when relevant.
- End with this exact line on its own: "This is general guidance, not a substitute for professional medical advice."

SAFETY:
- Everything in our catalog is over-the-counter. Never recommend prescription-only medication.
- EMERGENCY (chest pain, trouble breathing, stroke signs, severe bleeding, anaphylaxis, suicidal thoughts): tell them to call emergency services now; do not recommend products.
- Stay strictly in the health/skincare/wellness domain; politely redirect anything else.

OUR PHARMACY CATALOG (the ONLY products you may recommend — use the exact name):
${catalogForPrompt()}`;

const DEMO_NOTE =
  "_(Sample response — no AI key is active, so I'm showing a fixed example. Add a working OpenAI or Anthropic key for live, symptom-specific recommendations.)_\n\n";
const DEMO_FOOTER =
  "\n\nThis is general information, not a prescription or a substitute for professional medical advice.";

// Score catalog products against the patient's text and return the best matches.
function matchProducts(text, limit = 4) {
  const t = text.toLowerCase();
  const scored = PRODUCTS.map((p) => {
    let score = 0;
    for (const term of p.treats) {
      if (t.includes(term)) score += term.includes(" ") ? 3 : 2;
    }
    if (t.includes(p.category.toLowerCase())) score += 1;
    if (t.includes(p.generic.toLowerCase())) score += 4;
    return { p, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}

function buildDemoReply(messages) {
  const last = messages[messages.length - 1]?.content || "";
  const matches = matchProducts(last, 3);

  if (matches.length === 0) {
    return (
      DEMO_NOTE +
      `I'd like to help — could you tell me a bit more about what you're feeling and how long it's been going on?` +
      DEMO_FOOTER
    );
  }

  const lines = matches
    .slice(0, 2)
    .map((p) => `I'd suggest **${p.name}** — ${p.blurb} ${p.dosage}`)
    .join(" ");

  return (
    DEMO_NOTE +
    `Based on what you've told me, ${lines} If things feel severe or keep getting worse, it's worth seeing a doctor.` +
    DEMO_FOOTER
  );
}

async function callOpenAI(messages) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callAnthropic(messages) {
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.content?.map((c) => c.text).join("").trim() || "";
}

function activeProvider() {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (provider === "openai" && process.env.OPENAI_API_KEY) return "openai";
  // Fall back to whichever key exists.
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "demo";
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, provider: activeProvider() });
});

app.get("/api/products", (req, res) => {
  res.json({ categories: CATEGORIES, products: PRODUCTS });
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const provider = activeProvider();
    let reply;

    try {
      if (provider === "openai") {
        reply = await callOpenAI(messages);
      } else if (provider === "anthropic") {
        reply = await callAnthropic(messages);
      } else {
        await new Promise((r) => setTimeout(r, 700));
        reply = buildDemoReply(messages);
      }
      return res.json({ reply, provider });
    } catch (apiErr) {
      // The configured key failed (invalid key, no credits, rate limit, etc.).
      // Don't break the patient experience — fall back to the labeled sample.
      console.error(`${provider} call failed, using demo fallback:`, apiErr.message);
      reply = buildDemoReply(messages);
      return res.json({ reply, provider: "demo", fallback: true });
    }
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({
      error: "Something went wrong reaching the AI service.",
      detail: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Pharma demo running at http://localhost:${PORT}`);
  console.log(`  AI provider: ${activeProvider()}\n`);
});
