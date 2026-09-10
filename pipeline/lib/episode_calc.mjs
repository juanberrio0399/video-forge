// episode_calc.mjs — cálculo PURO de la memoria episódica (Fase 2). Determinista y testeable.
// Un "episodio" = los hechos de un video + su rendimiento RELATIVO al baseline por-video del canal.
import { median, pctVsBaseline } from "./analytics_math.mjs";

const DAY = 86400000;

// Vistas por día (vpd) de un video. Fecha inválida -> 0. No divide por menos de 1 día.
export function vpd(views, publishedAt, nowMs = Date.now()) {
  const pub = Date.parse(publishedAt);
  if (!Number.isFinite(pub)) return 0;
  const days = Math.max(1, (nowMs - pub) / DAY);
  return (Number(views) || 0) / days;
}

// Mediana de vpd de los videos MADUROS (edad >= matureDays): el baseline por-video del canal.
// Los recién publicados no se cuentan (aún no miden; Analytics va 2-3 días atrás).
export function medianVpd(videos, nowMs = Date.now(), matureDays = 5) {
  const vals = (videos || [])
    .filter((v) => v && v.published_at && (nowMs - Date.parse(v.published_at)) / DAY >= matureDays)
    .map((v) => vpd(v.views, v.published_at, nowMs));
  return median(vals);
}

// Episodio de un video: hechos + rendimiento relativo. Los campos cognitivos quedan en null;
// los llenarán las neuronas de fases posteriores (Hook/Title/Experiment).
export function buildEpisode(v, medVpd, nowMs = Date.now()) {
  const seconds = Number(v.seconds) || 0;
  const _vpd = vpd(v.views, v.published_at, nowMs);
  return {
    video_id: v.video_id,
    title: v.title || "",
    format: seconds > 0 && seconds <= 90 ? "short" : "long",
    published_at: v.published_at || null,
    age_days: v.published_at ? Math.round((nowMs - Date.parse(v.published_at)) / DAY) : null,
    seconds,
    privacy: v.privacy || null,
    views: Number(v.views) || 0,
    likes: Number(v.likes) || 0,
    watch_min: Number(v.watch_min) || 0,
    vpd: Math.round(_vpd * 10) / 10,
    vs_baseline_pct: medVpd ? pctVsBaseline(_vpd, medVpd) : null,
    // Campos cognitivos (los llenan neuronas futuras — Fase 4/5):
    hook_type: null,
    title_type: null,
    topic: v.topic || null,
    hypothesis: null,
    result: null,
  };
}
