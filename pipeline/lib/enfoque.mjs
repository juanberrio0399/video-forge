// enfoque.mjs — en que canal manda el Cerebro.
//
// Decision de Juan (2026-10-04): el Cerebro decide SOLO sobre Oddly Loop. The Data Lens
// queda fuera de sus veredictos, acciones y presion de meta — pero sus METRICAS se siguen
// recogiendo y mostrando, porque quiere poder verlas.
//
// No es una regla nueva ni un interruptor aparte: el ledger del Cerebro YA registraba la
// pausa de Data Lens (`type: "channel_pause"`, la escribe brain_live.mjs) con su criterio y
// su fecha de revision. `brain_live` la respetaba; `channel_brain` no se habia enterado y
// seguia emitiendo "🔴 REESTRUCTURAR" y pidiendo acciones de un canal pausado.
//
// Asi que esto no decide nada: lee la decision que ya estaba tomada y la hace valer.

/** Busca la pausa activa de un canal en el ledger. Devuelve la entrada o null. */
export function pausaDe(ledger, canal) {
  if (!Array.isArray(ledger)) return null;
  return ledger.find((e) => e && e.type === "channel_pause" && e.channel === canal) || null;
}

/**
 * ¿El Cerebro debe emitir veredictos y acciones para este canal?
 * Pausado -> NO decide (pero sus metricas se siguen mostrando).
 */
export function decideSobre(ledger, canal) {
  return !pausaDe(ledger, canal);
}

/** Linea para el mensaje: dice que esta en pausa, desde cuando y con que criterio. */
export function lineaPausa(pausa) {
  if (!pausa) return null;
  const desde = pausa.at ? String(pausa.at).slice(0, 10) : "?";
  const rev = pausa.review_at ? String(pausa.review_at).slice(0, 10) : null;
  const crit = pausa.criterion && pausa.criterion.value != null
    ? `se reanuda si ${pausa.metric || "la metrica"} ${pausa.criterion.op || ">="} ${pausa.criterion.value}`
    : null;
  return `⏸️ en PAUSA desde ${desde}${rev ? ` · se revisa el ${rev}` : ""}${crit ? ` · ${crit}` : ""}. El Cerebro no decide sobre este canal; las métricas se siguen midiendo.`;
}
