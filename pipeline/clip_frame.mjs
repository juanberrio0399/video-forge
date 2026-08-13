// clip_frame.mjs — helper compartido de los clippers: RECORTE 9:16 con SUJETO CENTRADO (smart crop).
// En vez de recortar siempre al centro (que corta al sujeto si está a un lado), la IA nos dice la
// posición horizontal del sujeto (sx, 0-1) y recortamos la ventana 9:16 centrada en ÉL. Calculamos
// el offset en Node con las dimensiones reales (ffprobe) -> robusto, sin expresiones frágiles de ffmpeg.
import fs from "node:fs";
import { execSync } from "node:child_process";

// Cierra el clip conservando su AUDIO ORIGINAL (los sonidos reales del video) como protagonista,
// con música MUY baja de fondo. Si el clip no tiene audio (cine mudo), usa música. loudnorm -14.
export function finishClip(rawClip, outPath) {
  const hasAudio = (() => { try { return execSync(`ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${rawClip}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().length > 0; } catch { return false; } })();
  const hasMusic = fs.existsSync("music.mp3");
  const LN = "loudnorm=I=-14:TP=-1.5";
  if (hasAudio && hasMusic) {
    execSync(`ffmpeg -y -i "${rawClip}" -stream_loop -1 -i music.mp3 -filter_complex "[0:a]volume=1.0[o];[1:a]volume=0.10[m];[o][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,${LN}[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -movflags +faststart -shortest "${outPath}"`, { stdio: "inherit" });
  } else if (hasAudio) {
    execSync(`ffmpeg -y -i "${rawClip}" -filter_complex "[0:a]${LN}[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -movflags +faststart -shortest "${outPath}"`, { stdio: "inherit" });
  } else if (hasMusic) {
    execSync(`ffmpeg -y -i "${rawClip}" -stream_loop -1 -i music.mp3 -filter_complex "[1:a]volume=0.5,afade=t=in:st=0:d=1,${LN}[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -movflags +faststart -shortest "${outPath}"`, { stdio: "inherit" });
  } else {
    execSync(`ffmpeg -y -i "${rawClip}" -map 0:v -an -c:v copy "${outPath}"`, { stdio: "inherit" });
  }
  return hasAudio;
}

export function sourceWH(film) {
  try { const s = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${film}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().split(","); return { w: +s[0] || 0, h: +s[1] || 0 }; } catch { return { w: 0, h: 0 }; }
}

// vf 9:16 con el sujeto centrado (sx) + grade + nitidez + viñeta cine.
export function smartCropVf(W, H, srcW, srcH, sx = 0.5, grade = "eq=contrast=1.06:saturation=1.05") {
  let base;
  const x = Math.max(0, Math.min(1, isFinite(+sx) ? +sx : 0.5));
  if (srcW > 0 && srcH > 0) {
    const scaledW = Math.round((srcW * H) / srcH);
    if (scaledW > W) {
      const cx = Math.max(0, Math.min(Math.round(scaledW * x - W / 2), scaledW - W));
      base = `scale=-2:${H}:flags=lanczos,crop=${W}:${H}:${cx}:0`;
    } else {
      base = `scale=${W}:-2:flags=lanczos,crop=${W}:${H}`; // fuente muy vertical: llena por ancho
    }
  } else base = `scale=-2:${H}:flags=lanczos,crop=${W}:${H}`;
  return `${base},${grade},unsharp=3:3:0.3,vignette=a=PI/7`;
}
