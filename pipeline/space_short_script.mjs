// space_short_script.mjs — GUION de un SHORT 9:16 calmado de espacio ("space facts to fall asleep to").
// Un dato del espacio que da asombro pero CONTADO SUAVE (para relajar, no para hypear), dividido en
// beats con QUERY pensada para encontrar VIDEO real de la NASA (movimiento, no fotos fijas).
//
// Uso: node pipeline/space_short_script.mjs <script.json> <narration.txt>
// Env: GEMINI_API_KEY(,2). Lee space_short_used.json (temas ya usados, de R2).
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [outScript = "script.json", outNarration = "narration.txt"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const tf = (u, o = {}, ms = 45000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

let used = [];
try { used = JSON.parse(fs.readFileSync("space_short_used.json", "utf8")); } catch {}
const recentUsed = (Array.isArray(used) ? used : []).slice(-50);

async function gemini(prompt) {
  for (let round = 0; round < 2; round++) for (const k of KEYS) for (const m of TEXT_MODELS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.9 } }),
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

const PROMPT = `You are a calm, dreamy science writer for a faceless YouTube SHORTS channel — the "space facts to fall asleep to" vibe.

Write a narration for a 40-55 second VERTICAL Short. US/English audience. ONE beautiful, real, mind-expanding space fact, told SOFTLY.

TONE (critical):
- SOOTHING, warm, wonder-filled — a soft late-night voice. Calm and slow, NOT hype.
- Gentle opening that invites wonder (e.g. "Drift with me for a moment…", "Far above you, right now…"). NO shouting, NO "you won't BELIEVE", NO hard hooks. The calm IS the hook.
- Flowing, smooth sentences. Accurate real astronomy only. Round big numbers softly.
- 95-125 words total. End on a soft, dreamy thought.

Pick ONE calm space subject NOT in this recently-used list: ${recentUsed.join(" | ") || "(none)"}.
Good subjects: a nebula where stars are born, Saturn's rings, Earth glowing from the ISS, the Milky Way's core, a solar flare, auroras seen from orbit, a comet's tail, the scale of the Sun, light-travel time, the silence of deep space, a galaxy far away.

Then split the narration into 5 visual BEATS. For EACH beat, a CONCRETE English search query of a REAL space subject that surely exists as NASA VIDEO FOOTAGE (moving, not a still) — prefer motion-friendly subjects: "nebula", "galaxy flythrough", "Earth from ISS", "aurora from space", "solar flare SDO", "Saturn Cassini flyby", "Jupiter Juno flyby", "Milky Way timelapse", "space station Earth". Each beat's query VISUALLY different from the others.

Return ONLY JSON:
{"topic":"the subject","title":"<=80 char calm SEO title, e.g. 'Space Facts to Fall Asleep To 🌌'","hook":"the soft first line","narration":"the full narration","beats":[{"text":"beat sentence","query":"NASA video search query"}],"hashtags":["#space","#relaxing","#Shorts","..."]}`;

let out = null;
const raw = await gemini(PROMPT);
if (raw) { try { out = JSON.parse(raw); } catch {} }

if (!out || !out.narration || !Array.isArray(out.beats) || !out.beats.length) {
  console.error("Gemini falló o JSON inválido -> fallback");
  out = {
    topic: "Orion Nebula",
    title: "Space Facts to Fall Asleep To 🌌",
    hook: "Drift with me for a moment.",
    narration: "Drift with me for a moment. Far away, in the sword of Orion, there is a cloud where stars are being born. It is fifteen hundred light years from here, so the glow you would see left home before the pyramids were built. Inside, gravity gathers gas into new suns, slowly, over millions of quiet years. Some of them will one day hold worlds of their own. And all of it drifts on, silent and patient, in the soft dark. Rest now, and let the stars keep turning.",
    beats: [
      { text: "Drift with me for a moment.", query: "Orion Nebula flythrough" },
      { text: "A cloud where stars are being born.", query: "nebula star formation" },
      { text: "Fifteen hundred light years from here.", query: "deep space galaxy" },
      { text: "New suns, slowly, over millions of years.", query: "solar flare SDO" },
      { text: "Silent and patient, in the soft dark.", query: "Earth from ISS night" },
    ],
    hashtags: ["#space", "#relaxing", "#sleep", "#Shorts", "#nasa"],
  };
}
out.topic = out.topic || (out.beats[0] && out.beats[0].query) || "space";
if (!Array.isArray(out.hashtags) || !out.hashtags.length) out.hashtags = ["#space", "#relaxing", "#Shorts"];

fs.writeFileSync(outScript, JSON.stringify(out, null, 2));
fs.writeFileSync(outNarration, String(out.narration).replace(/\s+/g, " ").trim());
fs.writeFileSync("chosen_topic.txt", out.topic);
console.log(`GUION de short de espacio listo — "${out.title}"`);
console.log(`Hook: ${out.hook}`);
console.log(out.beats.map((b, i) => `  ${i + 1}. [${b.query}] ${b.text}`).join("\n"));
