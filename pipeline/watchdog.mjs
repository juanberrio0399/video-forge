// watchdog.mjs — vigila la INFRAESTRUCTURA crítica del sistema: tokens de YouTube (los 2 canales) y
// acceso a R2 (almacenamiento). Si un token de YouTube muere o R2 se cae, TODO falla en silencio
// (no se publica ni se agenda nada). Este chequeo lo detecta y el workflow avisa a Telegram.
//
// Uso: node pipeline/watchdog.mjs   (el workflow le pasa R2_STATUS por env)
// Salidas: wd_report.txt (legible) + wd_fail.txt (nº de fallos, para decidir si avisar).
import fs from "node:fs";

const CHANNELS = [
  { label: "The Data Lens (YT_)", cid: process.env.YT_CLIENT_ID, sec: process.env.YT_CLIENT_SECRET, ref: process.env.YT_REFRESH_TOKEN },
  { label: "Oddly Loop (YT2_)", cid: process.env.YT2_CLIENT_ID, sec: process.env.YT2_CLIENT_SECRET, ref: process.env.YT2_REFRESH_TOKEN },
];

// Refresca el token del canal y confirma que sirve + tiene scope (pide el canal propio).
async function checkYT(c) {
  if (!c.cid || !c.sec || !c.ref) return { ok: false, msg: "faltan credenciales (secrets)" };
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: c.cid, client_secret: c.sec, refresh_token: c.ref, grant_type: "refresh_token" }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.access_token) return { ok: false, msg: "el token NO refresca → " + (j.error || r.status) + " " + String(j.error_description || "").slice(0, 90) };
    const cr = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${j.access_token}` } });
    if (!cr.ok) return { ok: false, msg: "la API de YouTube rechaza → " + cr.status + " " + (await cr.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 90) };
    const ch = (await cr.json().catch(() => ({}))).items?.[0];
    if (!ch) return { ok: false, msg: "token ok pero sin canal (¿scope?)" };
    return { ok: true, msg: `${ch.snippet.title} · ${ch.statistics.subscriberCount} subs` };
  } catch (e) { return { ok: false, msg: "excepción: " + (e && e.message ? e.message : e) }; }
}

const lines = [];
let fails = 0;

// R2: el workflow ya intentó leer un objeto conocido y pasa el resultado por env R2_STATUS.
const r2 = (process.env.R2_STATUS || "").trim();
if (r2 === "ok") lines.push("✅ R2 (almacenamiento): lectura OK");
else { lines.push("❌ R2 (almacenamiento): " + (r2 || "sin verificar") + "  → revisa que CLOUDFLARE_API_TOKEN tenga permiso R2 (además de Workers AI)"); fails++; }

for (const c of CHANNELS) {
  const r = await checkYT(c);
  lines.push(`${r.ok ? "✅" : "❌"} YouTube ${c.label}: ${r.msg}`);
  if (!r.ok) fails++;
}

const report = lines.join("\n");
console.log("=== Watchdog de infraestructura (R2 + YouTube) ===");
console.log(report);
console.log(`\nFallos: ${fails}`);
fs.writeFileSync("wd_report.txt", report);
fs.writeFileSync("wd_fail.txt", String(fails));
