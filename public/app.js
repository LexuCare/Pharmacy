const chat = document.getElementById("chat");
const messagesEl = document.getElementById("messages");
const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const sendBtn = form.querySelector(".chat__send");
const suggestionsEl = document.getElementById("suggestions");

// Conversation history sent to the API (excludes the greeting).
const history = [];
let greeted = false;

const GREETING =
  "Hi, I'm **Remy** 👋 your AI health & skincare advisor.\n\nTell me what's bothering you — a symptom, a skin concern, anything — and I'll suggest a few things that could help.";

/* ---------- Modal open / close ---------- */
function openChat() {
  chat.classList.add("open");
  chat.setAttribute("aria-hidden", "false");
  if (!greeted) {
    addMessage(GREETING, "bot");
    greeted = true;
  }
  setTimeout(() => input.focus(), 200);
}
function closeChat() {
  chat.classList.remove("open");
  chat.setAttribute("aria-hidden", "true");
}

document.querySelectorAll("[data-open-chat]").forEach((b) => b.addEventListener("click", openChat));
document.querySelectorAll("[data-close-chat]").forEach((b) => b.addEventListener("click", closeChat));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && chat.classList.contains("open")) closeChat();
});

/* ---------- Suggestion chips ---------- */
suggestionsEl.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const text = chip.getAttribute("data-suggest");
    input.value = text;
    form.requestSubmit();
  });
});

/* ---------- Lightweight markdown -> HTML ---------- */
function renderMarkdown(text) {
  const escape = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = escape(text).split("\n");
  let html = "";
  let inList = false;

  const inline = (s) =>
    s
      // Markdown links [text](url) -> keep just the text (model often emits empty-url links for products).
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // Bold first, then italics. Avoid regex lookbehind for older-Safari/iOS compatibility.
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  for (const raw of lines) {
    const line = raw.trim();
    if (/^[-•]\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(line.replace(/^[-•]\s+/, ""))}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (line) {
        const isFinePrint = /not a substitute for professional medical advice/i.test(line);
        html += `<p${isFinePrint ? ' class="msg__fineprint"' : ""}>${inline(line)}</p>`;
      }
    }
  }
  if (inList) html += "</ul>";
  return html;
}

/* ---------- Messages ---------- */
function addMessage(text, who) {
  const el = document.createElement("div");
  el.className = `msg msg--${who}`;
  el.innerHTML = who === "bot" ? renderMarkdown(text) : escapeText(text);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  if (who === "bot") speak(text);
  return el;
}

function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showTyping() {
  const el = document.createElement("div");
  el.className = "msg msg--bot";
  el.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

/* ---------- Send ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  history.push({ role: "user", content: text });
  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;

  const typingEl = showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    typingEl.remove();

    if (!res.ok) {
      addMessage(
        "Sorry, I ran into a problem reaching my brain just now. Please try again in a moment.",
        "bot"
      );
    } else {
      addMessage(data.reply, "bot");
      history.push({ role: "assistant", content: data.reply });
    }
  } catch (err) {
    typingEl.remove();
    addMessage("I couldn't connect just now. Please check your connection and try again.", "bot");
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
});

/* ---------- ROI count-up animation ---------- */
const counters = document.querySelectorAll(".roi-card__num");
const animateCount = (el) => {
  const target = parseInt(el.getAttribute("data-count"), 10);
  const suffix = el.getAttribute("data-suffix") || "";
  const duration = 1200;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.5 }
);
counters.forEach((c) => observer.observe(c));

/* ====================================================================== */
/*  VOICE  —  Text-to-Speech (Remy speaks) + Speech-to-Text (mic input)   */
/* ====================================================================== */

const headerAvatar = document.querySelector(".chat__id img");
const voiceToggle = document.getElementById("voiceToggle");
const micBtn = document.getElementById("micBtn");
const voiceSelect = document.getElementById("voiceSelect");

/* ---------- Text-to-Speech ---------- */
const synth = window.speechSynthesis;
let voiceEnabled = !!synth;
let preferredVoice = null;
const SAVED_VOICE_KEY = "remy_voice";

function englishVoices() {
  const all = synth.getVoices();
  const en = all.filter((v) => /^en/i.test(v.lang));
  return en.length ? en : all;
}

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  if (!voices.length) return;
  const saved = localStorage.getItem(SAVED_VOICE_KEY);
  if (saved) {
    const match = voices.find((v) => v.name === saved);
    if (match) {
      preferredVoice = match;
      return;
    }
  }
  // Prefer natural-sounding voices when no choice has been saved.
  preferredVoice =
    voices.find((v) => /samantha|karen|moira|tessa|serena|fiona|google us english|aria|jenny|libby/i.test(v.name)) ||
    voices.find((v) => /en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0] ||
    null;
}

function populateVoiceList() {
  if (!synth || !voiceSelect) return;
  const list = englishVoices();
  voiceSelect.innerHTML = list
    .map((v) => `<option value="${v.name}">${v.name.replace(/\s*\(.*?\)\s*/g, "")}</option>`)
    .join("");
  if (preferredVoice) voiceSelect.value = preferredVoice.name;
}

function initVoices() {
  pickVoice();
  populateVoiceList();
}

if (synth) {
  initVoices();
  synth.onvoiceschanged = initVoices;
}

if (voiceSelect) {
  voiceSelect.addEventListener("change", () => {
    const chosen = synth.getVoices().find((v) => v.name === voiceSelect.value);
    if (!chosen) return;
    preferredVoice = chosen;
    localStorage.setItem(SAVED_VOICE_KEY, chosen.name);
    // Turn voice on (so the preview is audible) and sync the toggle.
    voiceEnabled = true;
    if (voiceToggle) {
      voiceToggle.textContent = "🔊";
      voiceToggle.classList.remove("is-off");
      voiceToggle.setAttribute("aria-pressed", "true");
      voiceToggle.title = "Remy's voice: on";
    }
    synth.cancel();
    const preview = new SpeechSynthesisUtterance("Hi, I'm Remy. How does this voice sound?");
    preview.voice = chosen;
    preview.rate = 0.97;
    preview.pitch = 1.05;
    synth.speak(preview);
  });
}

// Build emoji-stripping regexes safely (Unicode-property regex can be unsupported
// on very old engines; constructing via new RegExp keeps the file parseable).
let EMOJI_RE = null;
let EMOJI_RANGE_RE = null;
try {
  EMOJI_RE = new RegExp("\\p{Extended_Pictographic}", "gu");
  EMOJI_RANGE_RE = new RegExp(
    "[\\u{1F1E6}-\\u{1F1FF}\\u{2190}-\\u{21FF}\\u{2B00}-\\u{2BFF}\\u{2700}-\\u{27BF}\\uFE0F\\u200D\u2605\u25AA\u25E6]",
    "gu"
  );
} catch (_) {
  /* older browser — emoji stripping will be skipped */
}

// Strip markdown, emojis and symbols so speech sounds clean.
function toSpeakable(text) {
  let out = text
    // Don't speak the legal disclaimer — it's shown as fine print instead.
    .replace(/this is general (guidance|information)[^.]*professional medical advice\.?/gi, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[\s]*[-•]\s+/gm, "")
    .replace(/[#>`_]/g, "");

  if (EMOJI_RE) out = out.replace(EMOJI_RE, "");
  if (EMOJI_RANGE_RE) out = out.replace(EMOJI_RANGE_RE, "");

  return out
    // Number ranges like "2-3" or "200–400" -> "2 to 3" (so it isn't read as "2 dash 3").
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1 to $2")
    // Spell out common units for natural speech.
    .replace(/(\d)\s*mg\b/gi, "$1 milligrams")
    .replace(/(\d)\s*ml\b/gi, "$1 milliliters")
    .replace(/(\d)\s*h\b/gi, "$1 hours")
    .replace(/(\d)\s*x\b/gi, "$1 times")
    .replace(/\bIU\b/g, "international units")
    // Any remaining dash used as a separator -> a natural pause.
    .replace(/\s[–—-]\s/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function speak(text) {
  if (!voiceEnabled || !synth) return;
  synth.cancel(); // stop any in-progress speech
  const utter = new SpeechSynthesisUtterance(toSpeakable(text));
  utter.rate = 0.97;
  utter.pitch = 1.05;
  if (preferredVoice) utter.voice = preferredVoice;
  utter.onstart = () => headerAvatar && headerAvatar.classList.add("is-speaking");
  utter.onend = () => headerAvatar && headerAvatar.classList.remove("is-speaking");
  utter.onerror = () => headerAvatar && headerAvatar.classList.remove("is-speaking");
  synth.speak(utter);
}

if (voiceToggle) {
  if (!synth) {
    voiceToggle.style.display = "none";
  }
  voiceToggle.addEventListener("click", () => {
    voiceEnabled = !voiceEnabled;
    voiceToggle.textContent = voiceEnabled ? "🔊" : "🔇";
    voiceToggle.setAttribute("aria-pressed", String(voiceEnabled));
    voiceToggle.title = `Remy's voice: ${voiceEnabled ? "on" : "off"}`;
    voiceToggle.classList.toggle("is-off", !voiceEnabled);
    if (!voiceEnabled && synth) synth.cancel();
  });
}

// Stop speaking when the chat is closed.
document.querySelectorAll("[data-close-chat]").forEach((b) =>
  b.addEventListener("click", () => synth && synth.cancel())
);

/* ---------- Speech-to-Text (microphone) ---------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (SpeechRecognition && micBtn) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    listening = true;
    micBtn.classList.add("is-listening");
    micBtn.title = "Listening… click to stop";
    input.placeholder = "Listening…";
  };

  recognition.onresult = (e) => {
    let transcript = "";
    for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
    input.value = transcript;
  };

  recognition.onerror = () => stopListening();
  recognition.onend = () => {
    stopListening();
    // Auto-send if we captured something.
    if (input.value.trim()) form.requestSubmit();
  };

  function stopListening() {
    listening = false;
    micBtn.classList.remove("is-listening");
    micBtn.title = "Speak your symptoms";
    input.placeholder = "Describe your symptoms…";
  }

  micBtn.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    if (synth) synth.cancel(); // don't talk over the user
    input.value = "";
    try {
      recognition.start();
    } catch (_) {
      /* start() can throw if called twice quickly — ignore */
    }
  });
} else if (micBtn) {
  // Browser doesn't support speech recognition — hide the mic.
  micBtn.classList.add("is-hidden");
}
