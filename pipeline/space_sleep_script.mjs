// space_sleep_script.mjs — GUION de un video LARGO de relajación/sueño para Oddly Loop:
// "Space Facts to Fall Asleep To". Voz de locutor CALMADO (sleep), datos reales del espacio,
// cada dato con una QUERY concreta para buscar imagen REAL de la NASA (dominio público).
// Nada de ganchos agresivos: tono suave, pausado, hipnótico, para dejar sonando y dormir.
//
// Uso: node pipeline/space_sleep_script.mjs <script.json> <narration.txt>
// Env: GEMINI_API_KEY(,2), MINUTES (duración objetivo, def 10). Lee space_sleep_used.json (de R2).
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [outScript = "script.json", outNarration = "narration.txt"] = process.argv.slice(2);
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
const MINUTES = Math.max(5, Math.min(40, +(process.env.MINUTES || 10) || 10));
const nFacts = Math.max(8, Math.min(26, Math.round(MINUTES * 1.7)));  // ~1 dato cada ~35 s a ritmo lento
const tf = (u, o = {}, ms = 45000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

let used = [];
try { used = JSON.parse(fs.readFileSync("space_sleep_used.json", "utf8")); } catch {}
const recentUsed = (Array.isArray(used) ? used : []).slice(-60);

async function gemini(prompt) {
  for (let round = 0; round < 2; round++) for (const k of KEYS) for (const m of TEXT_MODELS) {
    try {
      const res = await tf(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${k}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.85 } }),
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

const PROMPT = `You are a calm, professional sleep-narration writer for a faceless YouTube relaxation channel, in the style of the best "facts to fall asleep to" videos.

Write the script for a ${MINUTES}-minute SPACE relaxation video titled around "Space Facts to Fall Asleep To". US/English audience.

TONE (critical):
- SOOTHING, slow, warm, hypnotic — a soft late-night voice meant to make the listener drift off.
- NO hooks, NO hype, NO "you won't believe", NO questions that create tension. Calm declaratives only.
- Gentle, wandering, wonder-filled. Long, smooth sentences with soft rhythm. Second person occasionally ("imagine...", "drift with me...").
- Accurate real astronomy only. No invented numbers. Round big numbers softly ("about", "nearly").

STRUCTURE:
- intro: 2-3 soft sentences welcoming the listener, inviting them to relax, breathe, and let the mind float through space. No channel name.
- facts: EXACTLY ${nFacts} calm space "facts" — each 3-5 gentle sentences (~55-75 words). Cover a WANDERING variety: the Moon, planets (Saturn's rings, Jupiter, Mars, Venus, Neptune), the Sun, nebulae (Orion, Carina), galaxies (Milky Way, Andromeda), Hubble/JWST images, the ISS, comets, star birth and death, the scale and silence of deep space, light travel time. Each fact must feel like a slow, dreamy thought. Vary subjects so no two feel alike.
- For EACH fact, a CONCRETE English image search query of a REAL, ICONIC space subject that surely exists as a NASA photograph (use proper nouns: "Saturn Cassini", "Pillars of Creation Hubble", "Andromeda Galaxy", "Earth from ISS", "Jupiter Great Red Spot", "Orion Nebula", "Carina Nebula JWST", "Moon surface Apollo", "Milky Way core", "Sun solar flare SDO"). Each query visually DIFFERENT from the others.
- outro: 2 very soft closing sentences wishing the listener a peaceful, deep sleep. Trail off gently.

Do NOT reuse these recently-used opening subjects: ${recentUsed.join(" | ") || "(none)"}.

Return ONLY JSON:
{"title":"<=90 char calm SEO title in English, e.g. 'Space Facts to Fall Asleep To | Deep Space Relaxation for Sleep'","intro":"...","facts":[{"text":"the calm fact narration","query":"NASA image search query"}],"outro":"...","hashtags":["#sleep","#space","#relaxation","..."],"seo_desc":"2-3 sentence calm English description"}`;

let out = null;
const raw = await gemini(PROMPT);
if (raw) { try { out = JSON.parse(raw); } catch {} }

// Fallback mínimo (para no romper el pipeline si la IA falla).
if (!out || !Array.isArray(out.facts) || out.facts.length < 4) {
  console.error("Gemini falló o JSON inválido -> fallback mínimo");
  const seed = [
    ["Saturn Cassini", "Saturn floats in the dark, wrapped in rings of ice no wider than a house is tall. They stretch across a distance that could nearly reach the Moon, yet they are gossamer thin. If you could stand there, they would glow, silent and pale, turning slowly in the cold."],
    ["Pillars of Creation Hubble", "Far away, towers of gas and dust rise for light-years, lit from within by newborn stars. We call them the Pillars of Creation. What you see is ancient light, a portrait of a place as it was thousands of years ago, drifting quietly toward you across the void."],
    ["Andromeda Galaxy", "Andromeda is the nearest great galaxy to our own, a soft smudge of a trillion stars. Its light left home two and a half million years ago. Slowly, gently, it is falling toward the Milky Way, and one distant night the two will merge into one."],
    ["Earth from ISS", "From the space station, Earth turns below in perfect silence. City lights bloom and fade, thunderstorms flicker like distant thoughts, and a thin blue line of air is all that holds the living world. Everything you have ever known rests on that fragile curve."],
    ["Moon surface Apollo", "The Moon keeps one face turned toward us, always. Its dust is soft and grey, untouched by wind, holding footprints that will last a million years. Tonight it drifts overhead, the same quiet companion that has watched over every night that ever was."],
  ];
  out = {
    title: "Space Facts to Fall Asleep To | Deep Space Relaxation for Sleep",
    intro: "Settle in, and let your breathing slow. Tonight we drift softly through space, past quiet planets and distant stars. There is nothing to do now but rest, and let your mind float among them.",
    facts: seed.map(([query, text]) => ({ query, text })),
    outro: "Let the stars carry you the rest of the way. Sleep well, and drift gently now.",
    hashtags: ["#sleep", "#space", "#relaxation", "#facts", "#asmr"],
    seo_desc: "Calm space facts narrated softly to help you relax and fall asleep, with real imagery from deep space.",
  };
}

out.title = String(out.title || "Space Facts to Fall Asleep To | Deep Space Relaxation").slice(0, 95);
out.intro = String(out.intro || "").trim();
out.outro = String(out.outro || "").trim();
out.facts = (out.facts || []).filter((f) => f && f.text && f.query).map((f) => ({ text: String(f.text).trim(), query: String(f.query).trim() }));
if (!Array.isArray(out.hashtags) || !out.hashtags.length) out.hashtags = ["#sleep", "#space", "#relaxation"];
out.card_title = "Space Facts to Fall Asleep To"; // título corto y elegante para la tarjeta en pantalla
out.minutes = MINUTES;

// Narración: intro + datos (con pausas suaves entre ellos) + outro. Las pausas (líneas en blanco + "...")
// ayudan a la voz TTS a respirar y a dar el ritmo lento de sueño.
const PAUSE = "\n\n...\n\n";
const narration = [out.intro, ...out.facts.map((f) => f.text), out.outro]
  .filter(Boolean).join(PAUSE).replace(/[ \t]+/g, " ").trim();

fs.writeFileSync(outScript, JSON.stringify(out, null, 2));
fs.writeFileSync(outNarration, narration);
fs.writeFileSync("chosen_topic.txt", out.facts[0] ? out.facts[0].query : "space");
console.log(`GUION de sueño listo — "${out.title}"`);
console.log(`Datos: ${out.facts.length} · objetivo ${MINUTES} min · palabras narración: ${narration.split(/\s+/).length}`);
console.log(out.facts.map((f, i) => `  ${i + 1}. [${f.query}]`).join("\n"));
