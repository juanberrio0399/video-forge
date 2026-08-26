// llm_health.mjs — chequeo de qué proveedores de IA GRATIS están activos (tienen key y responden).
// Uso: node pipeline/llm_health.mjs   (necesita las env/keys de los proveedores que quieras probar)
import { health } from "./llm.mjs";

const r = await health();
console.log("=== Proveedores de IA gratis ===");
for (const p of r) console.log(`${p.ok ? "✅" : "❌"} ${p.name.padEnd(14)} ${String(p.ms).padStart(5)}ms  ${p.sample || ""}`);
const okList = r.filter((p) => p.ok).map((p) => p.name);
console.log(`\nActivos: ${okList.length ? okList.join(", ") : "(ninguno — revisa keys)"}`);
