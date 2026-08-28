// data_shock_script.mjs — Guion del formato VISUAL "DATA SHOCK" para The Data Lens (experimento paralelo
// al narrado). Números/estadísticas GIGANTES de historia sobre imágenes icónicas, sound-off first.
// Uso: node pipeline/data_shock_script.mjs [topic]   -> escribe script.json
import { genText } from "./llm.mjs";
import fs from "node:fs";

const seed = (process.argv[2] || "").trim();
const PROMPT = `You are a viral VISUAL Shorts creator for "The Data Lens", a data-driven history channel.
Create a punchy "DATA SHOCK" Short: shocking REAL historical NUMBERS shown BIG on screen, sound-off first, fast cuts. ${seed ? `Topic hint: ${seed}.` : "Pick ONE gripping theme (a war, empire, disaster, invention, plague, or money) with jaw-dropping real numbers."}

HARD RULES:
- 4 FACTS, each = ONE shocking, 100% REAL number/stat + a 2-4 word LABEL. Escalate: the biggest shock LAST. No invented figures.
- "num" must be SHORT and BIG (e.g. "200 MILLION", "1 DAY", "$0", "13 YEARS", "90%"). "label" = 2-4 words that land the punch.
- HOOK CARD: a ≤5-word curiosity-gap line for the first frame (e.g. "THE EMPIRE THAT VANISHED").
- TITLE: ≤70 chars, high-CTR, honest.
- Each fact: a CONCRETE Wikimedia image query of a REAL iconic subject (proper nouns/places/years), visually different from the others.

Return ONLY JSON:
{"title":"...","hook_card":"...","topic":"...","facts":[{"num":"200 MILLION","label":"lives lost","query":"1918 Spanish flu ward historical photo"}],"hashtags":["#History","#Shorts","#DataViz"]}`;

let out = null;
try { const t = await genText(PROMPT, { json: true }); out = typeof t === "string" ? JSON.parse(t) : t; } catch (e) { console.error("LLM:", e.message); }

if (!out || !Array.isArray(out.facts) || out.facts.length < 3) {
  console.error("guion inválido, uso fallback mínimo");
  out = { title: seed || "History's Most Shocking Numbers", hook_card: "NUMBERS THAT SHOCK", topic: seed || "history", facts: (out?.facts || []).slice(0, 4), hashtags: ["#History", "#Shorts"] };
}
out.facts = out.facts.slice(0, 4).map((f) => ({ num: String(f.num || "").slice(0, 16).toUpperCase(), label: String(f.label || "").slice(0, 40), query: String(f.query || out.topic || "history").slice(0, 90) }));
out.hook_card = String(out.hook_card || out.title || "DATA SHOCK").toUpperCase().slice(0, 42);
fs.writeFileSync("script.json", JSON.stringify(out, null, 2));
console.log(`GUION DATA SHOCK — "${out.title}" · hook: "${out.hook_card}"`);
out.facts.forEach((f, i) => console.log(`  ${i + 1}. ${f.num} — ${f.label}  [${f.query}]`));
