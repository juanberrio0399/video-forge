// render_fallback.mjs — RESPALDO cuando HyperFrames se cuelga/falla. Arma el video de la
// fase con ffmpeg usando el b-roll YA descargado (bg/*.mp4) + subtítulos quemados desde
// timing.json + la voz. Video simple pero COMPLETO (nunca deja la fase sin salida).
// Uso: node pipeline/render_fallback.mjs <timing.json> <voiceover.mp3> <bgDir> <out.mp4>
import fs from "node:fs";
import { execSync } from "node:child_process";

const [timingPath, voiceover, bgDir, out] = process.argv.slice(2);
const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));
const beats = timing.beats || [];
const total = timing.total || beats.reduce((s, b) => Math.max(s, b.end || 0), 0) || 60;
const W = 1920, H = 1080;

// 1) Fondo: concatenar los clips de b-roll ya bajados (loop hasta cubrir la duración).
const segs = fs.existsSync(bgDir) ? fs.readdirSync(bgDir).filter((f) => /\.(mp4|mov|webm)$/i.test(f)).sort().map((f) => `${bgDir}/${f}`) : [];
if (segs.length) {
  fs.writeFileSync("bgconcat.txt", segs.map((s) => `file '${process.cwd()}/${s}'`).join("\n") + "\n");
  execSync(`ffmpeg -y -stream_loop -1 -f concat -safe 0 -i bgconcat.txt -t ${total} -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},eq=brightness=-0.06:saturation=1.05" -an -r 30 bgfull.mp4`, { stdio: "inherit" });
} else {
  execSync(`ffmpeg -y -f lavfi -i color=c=0x0a0e18:s=${W}x${H}:d=${total}:r=30 bgfull.mp4`, { stdio: "inherit" });
}

// 2) Subtítulos .ass desde los beats (grandes, centrados, con borde).
const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(2); return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(5, "0")}`; };
let acc = 0; const events = [];
for (const b of beats) {
  const st = b.start != null ? b.start : acc;
  const en = b.end != null ? b.end : (st + (b.dur || 3));
  acc = en;
  const txt = (b.text || "").replace(/[{}\\]/g, "").replace(/\r?\n/g, " ").trim();
  if (txt) events.push(`Dialogue: 0,${ts(st)},${ts(en)},Def,,0,0,0,,${txt}`);
}
const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Outline,Shadow,Alignment,MarginL,MarginR,MarginV
Style: Def,Liberation Sans,54,&H00FFFFFF,&H00000000,&H00000000,1,5,0,2,90,90,110
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${events.join("\n")}
`;
fs.writeFileSync("caps.ass", ass);

// 3) Quemar subtítulos + mux voz -> video final de la fase.
execSync(`ffmpeg -y -i bgfull.mp4 -i "${voiceover}" -vf "subtitles=caps.ass" -map 0:v -map 1:a -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "${out}"`, { stdio: "inherit" });
console.log("Fallback render listo:", out);
