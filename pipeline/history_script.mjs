// history_script.mjs — Genera el GUION de un Short de "Historia que cambio el mundo".
// Elige un tema no usado (semilla curada o propuesto por la IA), y con Gemini escribe la
// NARRACION estilo HISTORIADOR con gancho brutal en los primeros segundos, dividida en beats
// visuales, y por cada beat una QUERY concreta para buscar footage de archivo (dominio publico).
//
// Uso: node pipeline/history_script.mjs <script.json> <narration.txt>
// Lee (cwd): history_used.json (temas ya usados, de R2), channel/history_topics.seed.json.
// Env: GEMINI_API_KEY(,2).
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [outScript = "script.json", outNarration = "narration.txt"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const tf = (u, o = {}, ms = 45000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

// Temas ya usados + semilla curada
let used = [];
try { used = JSON.parse(fs.readFileSync("history_used.json", "utf8")); } catch {}
const usedSet = new Set((Array.isArray(used) ? used : []).map((s) => String(s).toLowerCase().trim()));
let seed = [];
try { seed = JSON.parse(fs.readFileSync("channel/history_topics.seed.json", "utf8")).topics || []; } catch {}
const fresh = seed.filter((t) => !usedSet.has(t.toLowerCase().trim()));
// Elegir tema semilla: el primero libre (variar por longitud de la lista de usados para no repetir orden).
const pickIdx = usedSet.size % Math.max(1, fresh.length);
// TOPIC del workflow tiene prioridad; si no, un tema no usado de la semilla.
const seedTopic = (process.env.TOPIC || "").trim()
  || (fresh.length ? fresh[pickIdx] : (seed[usedSet.size % Math.max(1, seed.length)] || "A moment in history that changed the world"));

async function gemini(prompt, json = true) {
  for (let round = 0; round < 2; round++) for (const k of KEYS) for (const m of TEXT_MODELS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: json ? { responseMimeType: "application/json", temperature: 0.9 } : { temperature: 0.9 } }),
      });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); continue; }
      if (!res.ok) continue;
      const j = await res.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      if (t) return t;
    } catch {}
  }
  return null;
}

const PROMPT = `You are a master historian AND a viral YouTube Shorts scriptwriter. Topic: "${seedTopic}" — a moment in history that changed the world. (You may refine or reframe the exact topic for maximum intrigue, but stay historically accurate.)

Write a narration for a 45-55 second vertical Short, for a US/English audience.

HARD RULES:
- HOOK: the FIRST sentence (max ~10 words) must STOP the scroll — a shocking number, a dark twist, or a "what if" that opens a curiosity loop. NO slow intros, NO "Today we'll talk about". Start in the action.
- VOICE: authoritative HISTORIAN — vivid, tense, cinematic, present-tense where it hits harder. Every sentence earns the next.
- Build the story with rising tension; end on a punch or a reflection that reframes what they just heard.
- Length: 130-165 words total. Short, punchy sentences.
- 100% historically accurate. No invented quotes or fake stats.

Then split the narration into 6 visual BEATS. For EACH beat give a CONCRETE archive-footage search query in English that is likely to exist in PUBLIC-DOMAIN / Creative Commons archives (Archive.org, Wikimedia, NASA) — real events, places, eras (e.g. "Berlin Wall 1989 crowd", "D-Day Normandy landing 1944", "Apollo 11 launch 1969", "1929 Wall Street crash newsreel"). Prefer specific, filmable subjects over abstractions.

Return ONLY JSON:
{"topic":"...","title":"<=70 char high-CTR English title (no clickbait lies)","hook":"the first line","narration":"the full narration text","beats":[{"text":"beat sentence","query":"archive footage search query"}],"hashtags":["#History", "..."],"vibe":"cinematic|tension|epic"}`;

let out = null;
const raw = await gemini(PROMPT, true);
if (raw) { try { out = JSON.parse(raw); } catch {} }

// Fallback minimo si la IA falla: narracion basica del tema semilla (para no romper el pipeline).
if (!out || !out.narration || !Array.isArray(out.beats) || !out.beats.length) {
  console.error("Gemini fallo o JSON invalido -> uso fallback del tema semilla");
  out = {
    topic: seedTopic,
    title: seedTopic.slice(0, 70),
    hook: seedTopic,
    narration: `${seedTopic}. This is the story of how one moment rewrote the future — and why the world was never the same again.`,
    beats: [{ text: seedTopic, query: seedTopic.replace(/^The |^How |^A /i, "") }],
    hashtags: ["#History", "#Shorts", "#OnThisDay"],
    vibe: "cinematic",
  };
}
out.topic = out.topic || seedTopic;
out.vibe = ["cinematic", "tension", "epic"].includes((out.vibe || "").toLowerCase()) ? out.vibe.toLowerCase() : "cinematic";
if (!Array.isArray(out.hashtags) || !out.hashtags.length) out.hashtags = ["#History", "#Shorts"];

fs.writeFileSync(outScript, JSON.stringify(out, null, 2));
fs.writeFileSync(outNarration, String(out.narration).replace(/\s+/g, " ").trim());
fs.writeFileSync("chosen_topic.txt", out.topic);
console.log(`GUION listo — "${out.title}"`);
console.log(`Hook: ${out.hook}`);
console.log(`Beats: ${out.beats.length} · vibe: ${out.vibe}`);
console.log(out.beats.map((b, i) => `  ${i + 1}. [${b.query}] ${b.text}`).join("\n"));
