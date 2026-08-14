// learnings.mjs — MEJORA CONTINUA. Antes de escribir el guion del próximo video, mira el
// rendimiento REAL de lo ya publicado (vistas + minutos vistos) y las tendencias, y arma un
// BRIEF corto y accionable para el guionista: qué está funcionando, qué formato/ángulo/título
// replicar y 1-2 tendencias a explotar. Así cada video aprende del anterior.
//
// Uso: node pipeline/learnings.mjs [out.txt=learnings.txt] [out.json=learnings.json]
// Env: YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN (OAuth) + GEMINI_API_KEY
import fs from "node:fs";

const [outTxt = "learnings.txt", outJson = "learnings.json"] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, GEMINI_API_KEY } = process.env;

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function getToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  return j.access_token || null;
}

async function gemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  for (let round = 0; round < 2; round++) {
    for (const m of ["gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-latest"]) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (r.status === 429 || r.status === 503) { await sleep(8000); continue; }
        if (!r.ok) continue;
        const j = await r.json();
        const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (t) return t.trim();
      } catch {}
    }
  }
  return null;
}

// Guarda SIEMPRE algo (aunque falle todo) para no romper la producción.
function save(brief, top, source) {
  fs.writeFileSync(outTxt, brief);
  fs.writeFileSync(outJson, JSON.stringify({ brief, top, source, generated_at: new Date().toISOString() }, null, 2));
  console.log(`[learnings] fuente=${source} · ${top.length} videos analizados`);
  console.log(brief);
}

const GENERIC = "Aún sin datos propios suficientes. Aplica buenas prácticas de alta retención: gancho brutal en la 1ª frase, promesa temprana que se paga al final, cifras concretas de menor a mayor, un giro a mitad y otro al final, micro-ganchos entre secciones. Tema de datos/dinero con un número fuerte en el título.";

try {
  const token = YT_REFRESH_TOKEN ? await getToken() : null;
  const api = async (u) => { try { const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } }); return r.ok ? await r.json() : null; } catch { return null; } };

  let vids = [];
  if (token) {
    // uploads playlist -> ids -> stats
    const ch = await api("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true");
    const uploads = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    let ids = [];
    if (uploads) {
      const pl = await api(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}`);
      ids = (pl?.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
    }
    if (ids.length) {
      const det = await api(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,status,contentDetails&id=${ids.join(",")}`);
      vids = (det?.items || [])
        .filter((it) => it.status?.privacyStatus === "public")
        .map((it) => {
          const dur = it.contentDetails?.duration || "";
          const mm = dur.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
          const secs = mm ? (+(mm[1] || 0)) * 60 + (+(mm[2] || 0)) : 0;
          return { id: it.id, title: it.snippet?.title || "", type: secs > 0 && secs <= 60 ? "short" : "largo", views: +it.statistics?.viewCount || 0, likes: +it.statistics?.likeCount || 0, comments: +it.statistics?.commentCount || 0, watch: 0 };
        });
      // minutos vistos por video (Analytics; puede faltar el permiso o venir 0 por el retraso de 1-2 días)
      for (const v of vids) {
        const a = await api(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=2035-01-01&metrics=estimatedMinutesWatched&filters=video==${v.id}`);
        const mins = a?.rows?.[0]?.[0];
        if (mins != null) v.watch = Math.round(+mins);
      }
    }
  }

  vids.sort((a, b) => (b.watch - a.watch) || (b.views - a.views));
  const top = vids.slice(0, 10);

  if (!top.length) {
    // Sin videos públicos con datos: pídele a Gemini SOLO tendencias actuales + buenas prácticas.
    const t = await gemini(`Eres estratega de un canal faceless de YouTube de DATOS/DINERO en inglés (mercado EE.UU.). El canal aún no tiene métricas propias. En ESPAÑOL, MUY breve (4-6 líneas, sin relleno): 2-3 ángulos/temas de datos-dinero que están CALIENTES ahora para audiencia de EE.UU. y el patrón de título/gancho que mejor retiene. Serán instrucciones para escribir el próximo guion.`);
    save(t ? `${t}\n\n${GENERIC}` : GENERIC, [], token ? "sin-videos-publicos" : "sin-oauth");
  } else {
    const lines = top.map((v) => `- [${v.type}] "${v.title}" — ${v.views} vistas, ${v.watch} min vistos, ${v.likes} likes, ${v.comments} coment.`).join("\n");
    const brief = await gemini(
      `Eres estratega de crecimiento de un canal faceless de datos/dinero en YouTube (inglés, EE.UU.). Rendimiento REAL de lo publicado (ordenado por minutos vistos):\n${lines}\n\n` +
      `Escribe un BRIEF en ESPAÑOL para el guionista del PRÓXIMO video, MUY breve y accionable (máx 8 líneas, sin relleno):\n` +
      `1) Qué tema/ángulo/tipo de título está reteniendo MÁS y hay que REPLICAR.\n2) Qué evitar.\n3) 1-2 tendencias actuales que encajen con lo que funciona.\n` +
      `Da instrucciones concretas (no teoría): "haz X", "abre con Y", "título tipo Z".`
    );
    save(brief || (`Replica lo que más retiene:\n${lines}\n\n${GENERIC}`), top, "metricas-reales");
  }
} catch (e) {
  console.error("[learnings] error:", e.message);
  save(GENERIC, [], "error-fallback");
}
