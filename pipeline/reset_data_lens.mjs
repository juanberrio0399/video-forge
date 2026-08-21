// reset_data_lens.mjs — AUDITA o RESETEA The Data Lens a "cero limpio", SIN BORRAR nada.
//   audit  -> lista TODO (publico / programado / privado + shorts) y clasifica "prueba" vs "viejo".
//             Tambien clasifica la cola por producir. NO cambia nada.
//   apply  -> pone PRIVADO lo publico/programado en YouTube (desprograma) y agrega TODO el
//             inventario a hidden_videos.json (lo saca de la app: nada queda "por programar").
//   Todo reversible: para revivir un video, quitarlo de channel/hidden_videos.json.
// Uso: node pipeline/reset_data_lens.mjs <audit|apply>
import fs from "node:fs";

const mode = (process.argv[2] || "audit").toLowerCase();
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;

const tok = async () => {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("token " + JSON.stringify(j));
  return j.access_token;
};
const T = await tok();
const H = { Authorization: `Bearer ${T}` };
const get = async (u) => (await fetch(u, { headers: H })).json();

// 1) Listar TODOS los uploads del canal
const ch = await get("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true");
const up = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
let ids = [], page = "";
if (up) { do { const j = await get(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${up}&pageToken=${page}`); ids.push(...(j.items || []).map((i) => i.contentDetails.videoId)); page = j.nextPageToken || ""; } while (page); }

// 2) Estado de cada uno
const V = [];
for (let i = 0; i < ids.length; i += 50) {
  const j = await get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${ids.slice(i, i + 50).join(",")}`);
  for (const v of j.items || []) V.push({ id: v.id, title: v.snippet?.title || "", priv: v.status?.privacyStatus, publishAt: v.status?.publishAt || null, dur: v.contentDetails?.duration || "" });
}

// Heuristicas
const isMoney = (t) => /how much money|makes \$|\$\d+\s*(b|billion|m|million)|company makes|net worth|revenue|profit|empire/i.test(t || "");
const isShort = (v) => { const m = /PT(?:(\d+)M)?(?:(\d+)S)?/.exec(v.dur || ""); const s = (+(m?.[1] || 0)) * 60 + (+(m?.[2] || 0)); return s > 0 && s <= 60; };
const tag = (t) => (isMoney(t) ? "VIEJO-💰" : "prueba");

const publicos = V.filter((v) => v.priv === "public");
const programados = V.filter((v) => v.priv !== "public" && v.publishAt);
const privados = V.filter((v) => v.priv !== "public" && !v.publishAt);

// 3) Cola por producir (state.upcoming, si el workflow bajo state.json)
let upcoming = [];
try { const st = JSON.parse(fs.readFileSync("state.json", "utf8")); upcoming = st.upcoming || []; } catch {}

// 4) Resumen compacto para Telegram
const S = [];
S.push(`🧪 *Auditoría — The Data Lens*`);
S.push(`Total: ${V.length} · Públicos: ${publicos.length} · Programados: ${programados.length} · Privados: ${privados.length}`);
S.push(``);
S.push(`*Públicos (se ocultarían):*`);
if (!publicos.length) S.push(`• (ninguno)`);
for (const v of publicos) S.push(`• ${isShort(v) ? "short" : "largo"} · ${tag(v.title)} · ${(v.title || v.id).slice(0, 60)}`);
if (programados.length) { S.push(``); S.push(`*Programados (se desprograman):*`); for (const v of programados) S.push(`• ${v.publishAt} · ${(v.title || v.id).slice(0, 55)}`); }
S.push(``);
const shortsPriv = privados.filter(isShort);
S.push(`*Privados:* ${privados.length} (de esos ${shortsPriv.length} son shorts) → se sacan de la app`);
S.push(``);
S.push(`*Cola por producir (${upcoming.length}) — ¿prueba?:*`);
for (const u of upcoming.slice(0, 8)) S.push(`• #${u.n} · ${isMoney(u.topic) ? "VIEJO-💰" : "PRUEBA ✓"} · ${(u.topic || "").slice(0, 55)}`);
const moneyQueue = upcoming.filter((u) => isMoney(u.topic)).length;
S.push(``);
S.push(moneyQueue ? `⚠️ ${moneyQueue} en la cola parecen del nicho viejo de dinero.` : `✅ La cola es 100% de prueba (sin nicho de dinero).`);
const summary = S.join("\n");
fs.writeFileSync("audit_summary.txt", summary);
console.log(summary);

// 5) APPLY: ocultar en YouTube + sacar todo de la app
if (mode === "apply") {
  const hide = [...publicos, ...programados];
  let okHide = 0;
  for (const v of hide) {
    const r = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
      method: "PUT", headers: { ...H, "content-type": "application/json" },
      body: JSON.stringify({ id: v.id, status: { privacyStatus: "private", selfDeclaredMadeForKids: false } }),
    });
    const ok = r.ok; if (ok) okHide++;
    console.log(`HIDE_YT ${v.id} -> ${ok ? "private" : "ERR " + r.status}`);
  }
  let hidden = [];
  try { hidden = JSON.parse(fs.readFileSync("hidden.json", "utf8")); } catch {}
  const set = new Set(Array.isArray(hidden) ? hidden : []);
  V.forEach((v) => set.add(v.id));
  fs.writeFileSync("hidden_new.json", JSON.stringify([...set]));
  fs.writeFileSync("reset_summary.txt",
    `✅ *The Data Lens en cero limpio*\n` +
    `• YouTube: oculté ${okHide}/${hide.length} (públicos ${publicos.length} + programados ${programados.length}) → todo PRIVADO.\n` +
    `• App: saqué ${set.size} videos del tablero (nada queda "por programar").\n` +
    `• Producción: sigue AUTOMÁTICA con contenido de prueba.\n` +
    `Nada borrado — reversible quitándolos de channel/hidden_videos.json.`);
  console.log("HIDDEN_TOTAL=" + set.size);
}
