// telegram_broadcast.mjs — publica cada Short PÚBLICO nuevo en un CANAL público de Telegram (gratis,
// reusa el bot; la gente reenvía/comparte -> más vistas). Anti-duplicado por ledger. No spam.
// Uso: node pipeline/telegram_broadcast.mjs <state.json> <ledgerIn.json> <ledgerOut.json> <channelLabel>
// Env: TELEGRAM_BOT_TOKEN + DISTRIB_CHANNEL_ID (id o @usuario del canal donde el bot es admin).
import fs from "node:fs";
import { pickNew, caption } from "./lib/distribute.mjs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.DISTRIB_CHANNEL_ID;
if (!TOKEN || !CHAT) { console.error("Falta TELEGRAM_BOT_TOKEN o DISTRIB_CHANNEL_ID — nada que hacer."); process.exit(0); }

const [stateF, ledgerInF, ledgerOutF, channel] = process.argv.slice(2);
const rj = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };

const state = rj(stateF, {});
// Normaliza el inventario: Oddly = { list }; Data Lens = { longs, shorts }.
const list = Array.isArray(state.list) ? state.list
  : (Array.isArray(state.longs) || Array.isArray(state.shorts)) ? [...(state.shorts || []), ...(state.longs || [])]
  : [];
const done = new Set(rj(ledgerInF, []));
const nuevos = pickNew(list, done, 4); // máx 4/corrida: cadencia natural, sin ráfaga
if (!nuevos.length) { console.log("Telegram broadcast: nada nuevo."); process.exit(0); }

let posted = 0;
for (const v of nuevos) {
  const text = caption(v, channel, { max: 900 });
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: false }),
    });
    const j = await r.json();
    if (j.ok) { console.log(`✅ tg: ${v.video_id}`); done.add(v.video_id); posted++; }
    else console.error(`tg ${v.video_id}: ${JSON.stringify(j).slice(0, 160)}`);
  } catch (e) { console.error(`tg ${v.video_id}: ${e.message}`); }
}
fs.writeFileSync(ledgerOutF || "tg_broadcast_new.json", JSON.stringify([...done].slice(-1000)));
console.log(`Telegram broadcast: ${posted} publicados en el canal.`);
