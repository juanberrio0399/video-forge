// shorts_plan.mjs — la IA analiza el video y SUGIERE los Shorts: cuantos, de que
// momentos (timestamps reales), que tan largos, con titulo/gancho/hashtags/caption.
// Juan aprueba uno por uno. No genera nada: solo propone el plan.
//
// Uso: node pipeline/shorts_plan.mjs <voicemap.json> <timing.json> <plan_out.json>
import fs from "node:fs";
import { TEXT_MODELS } from "./_models.mjs";

const [voicemapPath, timingPath, planOut] = process.argv.slice(2);
const KEY = process.env.GEMINI_API_KEY;

const vm = JSON.parse(fs.readFileSync(voicemapPath, "utf8"));
const timing = fs.existsSync(timingPath) ? JSON.parse(fs.readFileSync(timingPath, "utf8")) : { beats: [] };
const vmBeats = vm.beats || vm;
const tBeats = timing.beats || [];
const total = timing.total || (tBeats.length ? tBeats[tBeats.length - 1].end : 0);

// Transcripcion con timestamps por beat (para que la IA elija momentos reales).
const lines = vmBeats.map((b, i) => {
  const t = tBeats[i] || {};
  const s = t.start != null ? Math.round(t.start) : "?";
  const e = t.end != null ? Math.round(t.end) : "?";
  return `[${s}-${e}s] ${(b.text || "").trim()}`;
}).join("\n");

async function gemini(prompt) {
  for (const m of TEXT_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
      });
      if (!r.ok) { console.error(`gemini ${m}: ${r.status}`); continue; }
      const j = await r.json();
      const t = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/g, "").trim();
      if (!t) continue;
      const p = JSON.parse(t); if (p && Array.isArray(p.shorts) && p.shorts.length) return p; // solo un plan valido (con shorts) cuenta
    } catch (e) { console.error(`gemini ${m}: ${e.message}`); }
  }
  return null;
}

const mins = Math.round(total / 60);
const notes = (process.env.SHORTS_NOTES || "").trim();
const prompt =
  `Eres estratega de YouTube Shorts para un canal faceless de datos/dinero en INGLES (mercado EE.UU.). ` +
  `Este es el video (${mins} min) con timestamps por linea:\n"""${lines.slice(0, 6000)}"""\n\n` +
  `Sugiere los MEJORES momentos autoconclusivos para convertir en Shorts verticales (9:16, entre 20 y 55 segundos, ` +
  `que se entiendan solos y enganchen en el primer segundo). Decide CUANTOS tienen sentido (regla: ~1 short por cada ` +
  `2-3 min, maximo 5). Prioriza revelaciones de cifras grandes y datos sorprendentes.` +
  (notes ? ` COMENTARIOS DE JUAN (PRIORIDAD, tenlos muy en cuenta y hazlo distinto a lo anterior): "${notes}".` : ``) +
  ` Devuelve SOLO JSON:\n` +
  `{"reasoning":"1-2 frases: cuantos shorts y por que","shorts":[{"title":"titulo scroll-stopping <60 chars","start_sec":N,"end_sec":N,"hook":"primera frase que retiene","hashtags":["#..."],"caption":"caption corto para el short"}]}`;

const plan = (await gemini(prompt)) || { reasoning: "Sin IA; propongo 1 short del gancho.", shorts: [{ title: "The number that never stops", start_sec: 0, end_sec: 40, hook: "YouTube makes $1,900 every second.", hashtags: ["#youtube", "#money", "#shorts"], caption: "How much YouTube makes every second." }] };

// Limpieza + limites (duracion 15-58s, dentro del video).
plan.shorts = (plan.shorts || []).slice(0, 5).map((s, i) => {
  let a = Math.max(0, Math.round(+s.start_sec || 0));
  let b = Math.round(+s.end_sec || a + 40);
  if (b <= a) b = a + 40;
  if (b - a > 58) b = a + 58;
  if (b - a < 15) b = a + 15;
  if (total && b > total) { b = Math.min(total, b); if (b - a < 15) a = Math.max(0, b - 40); }
  return {
    n: i,
    title: (s.title || `Short ${i + 1}`).slice(0, 90),
    start: a, end: b, dur: b - a,
    hook: (s.hook || "").slice(0, 200),
    hashtags: Array.isArray(s.hashtags) ? s.hashtags.slice(0, 6) : [],
    caption: (s.caption || "").slice(0, 300),
    approved: false, skipped: false,
  };
});
plan.reasoning = plan.reasoning || "";
plan.updated_at = new Date().toISOString();
fs.writeFileSync(planOut, JSON.stringify(plan, null, 2));
console.log(`Shorts sugeridos: ${plan.shorts.length}. ${plan.reasoning}`);
for (const s of plan.shorts) console.log(`  #${s.n}: ${s.title} (${s.start}-${s.end}s, ${s.dur}s)`);
