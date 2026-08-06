// verify_yt2.mjs — confirma que el OAuth del 2º canal (YT2_*) lee el canal CORRECTO.
// Renueva el token, pregunta channels.list?mine=true y reporta id + titulo. Compara con el
// canal esperado (Oddly Loop). Uso: node pipeline/verify_yt2.mjs
const { YT2_CLIENT_ID, YT2_CLIENT_SECRET, YT2_REFRESH_TOKEN } = process.env;
const EXPECTED = "UC6HjFkzmP0LlXeNtK7yMQgQ"; // Oddly Loop
const tf = (u, o = {}, ms = 12000) => fetch(u, { ...o, signal: AbortSignal.timeout(ms) });

if (!YT2_CLIENT_ID || !YT2_CLIENT_SECRET || !YT2_REFRESH_TOKEN) {
  console.error("FALTAN secrets YT2_* (revisa que los 3 esten guardados)."); process.exit(1);
}
try {
  const tr = await (await tf("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT2_CLIENT_ID, client_secret: YT2_CLIENT_SECRET, refresh_token: YT2_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
  if (!tr.access_token) { console.error("NO pude renovar el token OAuth (revisa client_secret / refresh_token):", JSON.stringify(tr).slice(0, 300)); process.exit(1); }
  const ch = await (await tf("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { Authorization: `Bearer ${tr.access_token}` } })).json();
  const c = (ch.items || [])[0];
  if (!c) { console.error("El token no devolvio ningun canal (¿autorizaste sin elegir canal?)."); process.exit(1); }
  const id = c.id, title = c.snippet?.title, subs = c.statistics?.subscriberCount;
  const ok = id === EXPECTED;
  const msg = `${ok ? "✅" : "⚠️"} Canal del token YT2: "${title}" (${id})${ok ? " — CORRECTO (Oddly Loop)" : ` — NO coincide con el esperado ${EXPECTED}. Reautoriza eligiendo Oddly Loop.`}`;
  console.log(msg + `\nSubs: ${subs || 0}`);
  const fs = await import("node:fs");
  fs.writeFileSync("yt2_verify.txt", msg);
  process.exit(ok ? 0 : 2);
} catch (e) { console.error("Error verificando YT2:", e.message); process.exit(1); }
