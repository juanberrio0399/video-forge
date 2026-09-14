// nonempty.mjs — guarda de integridad (auditoría BR-11): sale 0 solo si el JSON tiene contenido real.
// Evita que un flujo con la fuente vacía SOBRESCRIBA en R2 la memoria buena de ayer con un archivo vacío.
// Uso: node pipeline/nonempty.mjs <archivo.json> <clave-array>
import fs from "node:fs";
const [file, key] = process.argv.slice(2);
try {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const arr = key ? j[key] : j;
  if (Array.isArray(arr) && arr.length > 0) process.exit(0);
  console.log(`nonempty: ${file} sin "${key}" con datos -> NO se sube (se conserva la memoria anterior)`);
} catch { console.log(`nonempty: ${file} ilegible -> NO se sube`); }
process.exit(1);
