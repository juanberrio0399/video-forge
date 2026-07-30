// fix_shorts_plan.mjs — corrige el plan de shorts para que apunte a los video_id
// PUBLICOS reales (los que se publicaron), no a los duplicados privados. Empareja
// por un trozo distintivo del titulo.
// Uso: node pipeline/fix_shorts_plan.mjs <plan.json>
import fs from "node:fs";

const planPath = process.argv[2] || "plan.json";
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));

// Los 3 shorts que quedaron PUBLICOS en el canal (inventario del 2026-07-30).
const MAP = [
  { match: "Earns Every Single Second", id: "A8xhmMKMenY" },
  { match: "Secret $10 Billion", id: "NwsTwl_8HT8" },
  { match: "Beat Netflix", id: "mQbfkeO4nFs" },
];

let changed = 0;
for (const s of plan.shorts || []) {
  const m = MAP.find((x) => (s.title || "").includes(x.match));
  if (m && s.video_id !== m.id) {
    console.log(`FIX "${s.title}"  ${s.video_id || "(vacio)"} -> ${m.id}`);
    s.video_id = m.id;
    s.approved = true; // asegurar que se muestren como del plan
    changed++;
  }
}
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
console.log(`Listo: ${changed} short(s) reapuntados a su video PUBLICO.`);
