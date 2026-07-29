// shorts_generate.mjs — genera y sube los Shorts APROBADOS del plan.
// Por cada short aprobado: recorta el segmento del video 16:9, lo convierte a 9:16
// (video centrado sobre un fondo desenfocado de si mismo = se ve todo, estilo pro),
// le pone el titulo arriba y el handle abajo, y lo sube a YouTube como Short PRIVADO.
//
// Uso: node pipeline/shorts_generate.mjs <plan.json> <video.mp4> <out_plan.json>
import fs from "node:fs";
import { execSync } from "node:child_process";

const [planPath, videoPath, outPlan] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const HANDLE = "@TheDataLensHQ";
const FONT = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"].find((f) => fs.existsSync(f)) || "";

async function getToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET,
      refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("token: " + JSON.stringify(j));
  return j.access_token;
}

async function uploadShort(token, file, title, description) {
  const size = fs.statSync(file).size;
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, "content-type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/mp4",
    },
    body: JSON.stringify({
      snippet: { title: title.slice(0, 100), description: description.slice(0, 4900), categoryId: "27", defaultLanguage: "en" },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
    }),
  });
  if (!init.ok) throw new Error("init " + init.status + " " + (await init.text()).slice(0, 200));
  const url = init.headers.get("location");
  const up = await fetch(url, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(size) }, body: fs.readFileSync(file) });
  const res = await up.json();
  if (!res.id) throw new Error("upload " + JSON.stringify(res).slice(0, 200));
  return res.id;
}

function wrap(t, per = 22) {
  const w = (t || "").split(/\s+/); const lines = []; let cur = "";
  for (const x of w) { if ((cur + " " + x).trim().length > per && cur) { lines.push(cur); cur = x; } else cur = (cur + " " + x).trim(); }
  if (cur) lines.push(cur); return lines.slice(0, 3).join("\n");
}

function makeShort(s, out) {
  // 9:16: fondo = el mismo clip escalado a cubrir + desenfoque; encima el clip a 1080 de ancho.
  let vf =
    "[0:v]split=2[bg][fg];" +
    "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:4[bgb];" +
    "[fg]scale=1080:-2[fgs];" +
    "[bgb][fgs]overlay=(W-w)/2:(H-h)/2[base]";
  if (FONT) {
    const tf = `${out}.title.txt`;
    fs.writeFileSync(tf, wrap(s.title));
    const hf = `${out}.handle.txt`;
    fs.writeFileSync(hf, HANDLE);
    vf += `;[base]drawtext=fontfile='${FONT}':textfile='${tf}':fontcolor=white:fontsize=58:line_spacing=8:box=1:boxcolor=black@0.5:boxborderw=22:x=(w-text_w)/2:y=150[t1];` +
          `[t1]drawtext=fontfile='${FONT}':textfile='${hf}':fontcolor=white@0.85:fontsize=40:x=(w-text_w)/2:y=h-150[vout]`;
  } else {
    vf += ";[base]copy[vout]";
  }
  execSync(
    `ffmpeg -y -ss ${s.start} -to ${s.end} -i "${videoPath}" -filter_complex "${vf}" -map "[vout]" -map 0:a? ` +
    `-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -movflags +faststart "${out}"`,
    { stdio: "inherit" }
  );
}

const token = await getToken();
const approved = (plan.shorts || []).filter((s) => s.approved && !s.video_id);
const done = [];
for (const s of approved) {
  const out = `short_${s.n}.mp4`;
  try {
    makeShort(s, out);
    const desc = [s.caption || s.hook || s.title, "", (s.hashtags || []).join(" "), "#Shorts", "", `▶️ ${HANDLE}`].join("\n");
    const id = await uploadShort(token, out, `${s.title} #Shorts`, desc);
    s.video_id = id; s.uploaded_at = new Date().toISOString();
    done.push({ n: s.n, title: s.title, video_id: id, url: `https://youtu.be/${id}` });
    console.log(`Short #${s.n + 1} subido: https://youtu.be/${id}`);
  } catch (e) {
    console.error(`Short #${s.n + 1} fallo: ${e.message}`);
  }
}
fs.writeFileSync(outPlan, JSON.stringify(plan, null, 2));
// Manda CADA short aprobado que YA esta subido (los nuevos + los de antes), con su link.
const uploaded = (plan.shorts || [])
  .filter((s) => s.approved && s.video_id)
  .map((s) => ({ n: s.n, title: s.title, video_id: s.video_id, url: `https://youtu.be/${s.video_id}` }));
fs.writeFileSync("shorts_uploaded.json", JSON.stringify(uploaded, null, 2));
fs.writeFileSync("shorts_result.txt", uploaded.length
  ? `✅ ${uploaded.length} Short(s) listo(s) como PRIVADOS${done.length ? ` (${done.length} nuevo(s))` : ""}. Te mando cada uno con su link para revisarlo y aprobarlo (publicar).`
  : `⚠️ No hay Shorts para mostrar (¿ninguno aprobado?).`);
console.log("---\n" + fs.readFileSync("shorts_result.txt", "utf8"));
