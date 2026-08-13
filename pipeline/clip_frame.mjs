// clip_frame.mjs — helper compartido de los clippers: RECORTE 9:16 con SUJETO CENTRADO (smart crop).
// En vez de recortar siempre al centro (que corta al sujeto si está a un lado), la IA nos dice la
// posición horizontal del sujeto (sx, 0-1) y recortamos la ventana 9:16 centrada en ÉL. Calculamos
// el offset en Node con las dimensiones reales (ffprobe) -> robusto, sin expresiones frágiles de ffmpeg.
import { execSync } from "node:child_process";

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
