// best_slot.mjs — imprime la PROXIMA mejor hora (ET) libre como ISO UTC, para programar
// publicaciones del canal auto. Mismas franjas que el canal 1 (2/dia). Evita chocar con
// horas ya ocupadas si se pasan por argumento (ISOs separados por coma).
// Uso: node pipeline/best_slot.mjs [ocupadas_iso_csv]
const occupied = (process.argv[2] || "").split(",").filter(Boolean).map((s) => Date.parse(s)).filter((n) => !isNaN(n));

function etOffsetHours(d) {
  try { const s = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName").value; const m = s.match(/GMT([+-]?\d{1,2})/); return m ? parseInt(m[1], 10) : -4; } catch { return -4; }
}
// Franjas (ET) por día. 4/día para la cadencia ramp (1 por categoría); pico tarde/noche EEUU.
function bestHoursET(dow) { if (dow === 0 || dow === 6) return [9, 12, 15, 18]; if (dow === 1) return [12, 15, 18, 21]; return [11, 14, 17, 20]; }

const now = Date.now(), minAhead = now + 2 * 3600 * 1000;
const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
let slots = [];
for (let day = 0; day < 21; day++) {
  const probe = new Date(now + day * 86400 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(probe);
  const y = +parts.find((p) => p.type === "year").value, mo = +parts.find((p) => p.type === "month").value, da = +parts.find((p) => p.type === "day").value;
  const dow = dowMap[parts.find((p) => p.type === "weekday").value] ?? 2;
  const off = etOffsetHours(probe);
  for (const h of bestHoursET(dow)) slots.push(Date.UTC(y, mo - 1, da, h - off, 0, 0));
}
slots.sort((a, b) => a - b);
for (const s of slots) {
  if (s < minAhead) continue;
  if (occupied.some((o) => Math.abs(o - s) < 3600 * 1000)) continue;
  process.stdout.write(new Date(s).toISOString());
  process.exit(0);
}
process.stdout.write(new Date(now + 3 * 3600 * 1000).toISOString());
