// make_thumbnail.mjs — genera una MINIATURA 9:16 para el Short: toma un frame llamativo del propio
// video (así la miniatura SIEMPRE coincide con el contenido) y le pone el gancho corto (thumb_text)
// en grande, con contorno y un degradado oscuro abajo para que se lea sobre cualquier fondo. Gratis, sin API.
//
// Uso: node pipeline/make_thumbnail.mjs <video.mp4> <script.json> <out.jpg>
import fs from "node:fs";
import { execSync } from "node:child_process";

const [video = "short.mp4", scriptPath = "script.json", out = "thumbnail.jpg"] = process.argv.slice(2);
const script = (() => { try { return JSON.parse(fs.readFileSync(scriptPath, "utf8")); } catch { return {}; } })();
// Preferir el FONDO sin subtítulos quemados (spacework/bg.mp4) para que la miniatura no tenga doble texto.
const src = fs.existsSync("spacework/bg.mp4") ? "spacework/bg.mp4" : video;
const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${src}"`).toString().trim()) || 30;
const at = (dur * 0.42).toFixed(1);  // un frame ~40% del video (buen momento de contenido)

const FONTS = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"];
const FONT = FONTS.find((f) => fs.existsSync(f)) || "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

// Gancho corto (2-4 palabras). Si es largo, lo parte en 2 líneas para que quepa grande.
let text = String(script.thumb_text || script.topic || "DEEP SPACE").toUpperCase().replace(/[^A-Z0-9 &'-]/g, "").trim().slice(0, 24) || "DEEP SPACE";
if (text.length > 12 && text.includes(" ")) {
  const w = text.split(/\s+/), mid = Math.ceil(w.length / 2);
  text = w.slice(0, mid).join(" ") + "\n" + w.slice(mid).join(" ");
}
fs.writeFileSync("thumbtext.txt", text);

// Frame -> 1080x1920, realce suave, degradado oscuro abajo (drawbox semitransparente) + gancho grande con contorno.
const vf = [
  "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
  "eq=contrast=1.07:saturation=1.12:brightness=0.01",
  "drawbox=x=0:y=1230:w=1080:h=690:color=black@0.38:t=fill",  // franja oscura para que el texto resalte
  `drawtext=textfile=thumbtext.txt:fontfile='${FONT}':fontcolor=white:fontsize=118:line_spacing=14:borderw=7:bordercolor=black:shadowcolor=black@0.7:shadowx=4:shadowy=4:x=(w-text_w)/2:y=h-tw-360:text_align=C`,
].join(",");

try {
  execSync(`ffmpeg -y -ss ${at} -i "${src}" -frames:v 1 -vf "${vf}" -q:v 2 "${out}"`, { stdio: "ignore" });
} catch (e) {
  // Respaldo sin text_align (ffmpeg viejo): centra por y fijo.
  const vf2 = vf.replace(":text_align=C", "").replace("y=h-tw-360", "y=1480");
  execSync(`ffmpeg -y -ss ${at} -i "${src}" -frames:v 1 -vf "${vf2}" -q:v 2 "${out}"`, { stdio: "ignore" });
}
console.log(`Miniatura -> ${out} · gancho "${text.replace(/\n/g, " ")}" · frame @${at}s`);
