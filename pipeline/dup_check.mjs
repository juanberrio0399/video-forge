// dup_check.mjs — GUARDA anti-duplicados: evita producir un tema que YA existe en el canal.
// Usa Gemini para comparar por SIGNIFICADO (robusto a redacciones distintas: "1,000,000" vs "1 million").
// Sale 1 si es DUPLICADO (para que produce_video aborte). Sale 0 si es tema nuevo (o si no puede juzgar).
// Uso: node pipeline/dup_check.mjs "<topic>"
// Env: GEMINI_API_KEY, YT_CLIENT_ID/SECRET/REFRESH
const topic = process.argv[2] || "";
const { GEMINI_API_KEY, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!topic) { console.log("Sin topic -> permito."); process.exit(0); }

async function getTitles() {
  if (!YT_REFRESH_TOKEN) return [];
  try {
    const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
    const token = t.access_token; if (!token) return [];
    const api = async (u) => { const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } }); return r.ok ? r.json() : null; };
    const ch = await api("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true");
    const up = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads; if (!up) return [];
    const pl = await api(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${up}`);
    // Solo LARGOS (los shorts no cuentan como duplicado de tema).
    return (pl?.items || []).map((i) => i.snippet?.title || "").filter((t) => t && !/#shorts/i.test(t));
  } catch { return []; }
}
async function gemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  for (const m of ["gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      if (!r.ok) continue;
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return t.trim();
    } catch {}
  }
  return null;
}

const titles = await getTitles();
if (!titles.length) { console.log("Sin videos en el canal -> permito producir."); process.exit(0); }

const prompt = `Un canal faceless de YouTube de datos/dinero ya tiene estos videos LARGOS:\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n` +
  `¿El siguiente tema NUEVO es esencialmente el MISMO tema/ángulo que alguno de arriba (un duplicado que confundiría a la audiencia)? Ignora diferencias de redacción/cifras ("1,000,000" = "1 million").\n` +
  `Tema nuevo: "${topic}"\n\n` +
  `Responde SOLO con una linea: "DUP: <numero del video>" si es un duplicado claro, o "NEW" si aporta algo distinto.`;

const ans = await gemini(prompt);
if (ans == null) { console.log("Gemini no respondio -> permito (no bloqueo por un blip)."); process.exit(0); }
console.log(`Juicio: ${ans}`);
if (/^\s*DUP\b/i.test(ans)) {
  const num = (ans.match(/DUP:?\s*(\d+)/i) || [])[1];
  console.error(`DUPLICADO del video ${num ? "#" + num + " (" + (titles[+num - 1] || "?") + ")" : ""}.`);
  process.exit(1);
}
console.log("Tema NUEVO -> ok producir.");
