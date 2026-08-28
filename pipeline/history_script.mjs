// history_script.mjs — Genera el GUION de un Short de "Historia que cambio el mundo".
// Elige un tema no usado (semilla curada o propuesto por la IA), y con Gemini escribe la
// NARRACION estilo HISTORIADOR con gancho brutal en los primeros segundos, dividida en beats
// visuales, y por cada beat una QUERY concreta para buscar footage de archivo (dominio publico).
//
// Uso: node pipeline/history_script.mjs <script.json> <narration.txt>
// Lee (cwd): history_used.json (temas ya usados, de R2), channel/history_topics.seed.json.
// Env: GEMINI_API_KEY(,2).
import fs from "node:fs";
import { genText } from "./llm.mjs";  // Gemini -> Cloudflare Workers AI (fallback gratis, sin cuota)

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

// CATEGORIA (experimento A/B/C): si viene DIRECTION, la IA elige un tema DENTRO de esa direccion.
const DIRECTION = (process.env.DIRECTION || "").trim();
let dirDef = null;
try { dirDef = ((JSON.parse(fs.readFileSync("channel/direction.json", "utf8")).directions) || []).find((d) => d.key === DIRECTION); } catch {}
const recentUsed = (Array.isArray(used) ? used : []).slice(-40);
const topicLine = (process.env.TOPIC || "").trim()
  ? `Topic: "${seedTopic}" — a moment in history that changed the world. (You may refine or reframe the exact topic for maximum intrigue, but stay historically accurate.)`
  : dirDef
  ? `Pick a SPECIFIC, real, world-changing HISTORY topic in THIS category and write about it. Category "${DIRECTION}": ${dirDef.desc}\nDo NOT reuse any of these already-used topics: ${recentUsed.join(" | ") || "(none)"}.`
  : `Topic: "${seedTopic}" — a moment in history that changed the world. (You may refine or reframe the exact topic for maximum intrigue, but stay historically accurate.)`;

const PROMPT = `You are a master historian AND a viral YouTube Shorts scriptwriter. ${topicLine}

Write a narration for a TIGHT 25-35 second vertical Short, for a US/English audience. (Data 2026: Shorts over ~40s bleed retention; the algorithm sweet spot is 20-30s. Keep it lean and fast.)

HARD RULES:
- HOOK: the FIRST sentence (max ~8 words) must STOP the scroll — a shocking number, a dark twist, or a "what if" that opens a curiosity loop. NO slow intros, NO "Today we'll talk about". Start mid-action, with force.
- HOOK CARD: also give a "hook_card" — the hook compressed to **≤5 words, ALL CAPS-worthy, punchy** — it will be BURNED as big bold text on the very first frame so scrollers who watch WITHOUT sound (85% of them) get grabbed instantly. Make it a curiosity gap (e.g. "THE 75-DAY SIEGE", "1 MISTAKE, 200M DEAD", "THE LIE YOU BELIEVE").
- VOICE: authoritative HISTORIAN with URGENCY — vivid, tense, cinematic, present-tense where it hits harder. Punchy, dramatic — like a gripping documentary trailer, NOT a calm lecture. Every sentence escalates.
- SENTENCES: short and driving (5-11 words each). Hard cuts, momentum. Land 1-2 mini-cliffhangers before the payoff.
- Build rising tension; end on a punch that reframes everything AND a 3-word call to linger/follow.
- Length: 65-85 words total (that is ~25-35s spoken). Do NOT exceed 85 words.
- 100% historically accurate. No invented quotes or fake stats.

Then split the narration into 4-5 visual BEATS. For EACH beat give a CONCRETE search query in English of a REAL, ICONIC, SEARCHABLE subject that surely exists as a historical PHOTO on Wikimedia Commons — use proper nouns, places, people and years (e.g. "Berlin Wall 1989", "Brandenburg Gate November 1989", "Gunter Schabowski press conference", "East Germans crossing Berlin Wall", "Apollo 11 launch 1969", "1929 Wall Street crash crowd"). Each beat's query MUST be visually different from the others (different place/person/moment) so the images never repeat. Avoid abstractions.

Return ONLY JSON:
{"topic":"...","title":"<=70 char high-CTR English title (no clickbait lies)","hook":"the first line","hook_card":"<=5 words, punchy, for the opening on-screen text","narration":"the full narration text","beats":[{"text":"beat sentence","query":"archive footage search query"}],"hashtags":["#History", "..."],"vibe":"cinematic|tension|epic"}`;

let out = null;
const raw = await genText(PROMPT, { json: true });
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
out.direction = DIRECTION || out.direction || "";
out.vibe = ["cinematic", "tension", "epic"].includes((out.vibe || "").toLowerCase()) ? out.vibe.toLowerCase() : "cinematic";
if (!Array.isArray(out.hashtags) || !out.hashtags.length) out.hashtags = ["#History", "#Shorts"];

fs.writeFileSync(outScript, JSON.stringify(out, null, 2));
fs.writeFileSync(outNarration, String(out.narration).replace(/\s+/g, " ").trim());
fs.writeFileSync("chosen_topic.txt", out.topic);
fs.writeFileSync("chosen_direction.txt", out.direction);
console.log(`GUION listo [${out.direction || "sin-categoria"}] — "${out.title}"`);
console.log(`Hook: ${out.hook}`);
console.log(`Beats: ${out.beats.length} · vibe: ${out.vibe}`);
console.log(out.beats.map((b, i) => `  ${i + 1}. [${b.query}] ${b.text}`).join("\n"));
