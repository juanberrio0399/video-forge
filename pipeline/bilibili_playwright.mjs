// bilibili_playwright.mjs — Sube un video a Bilibili Studio (member.bilibili.com) automatizando el
// navegador con Playwright, EN LA NUBE (GitHub Actions, headless). Usa la cookie web del creador
// (SESSDATA/bili_jct/DedeUserID/DedeUserID__ckMd5) — la misma con la que subes a mano. Replica el flujo humano.
//
// Uso: node pipeline/bilibili_playwright.mjs <video.mp4>
// Env: BILIBILI_COOKIE, BILI_TITLE, BILI_DESC, BILI_TAG (coma), [BILI_UPLOAD_URL]
// Deja evidencia en shots/ (capturas) + page.html (DOM) para validar/depurar.
import { chromium } from "playwright";
import fs from "node:fs";

const VIDEO = process.argv[2] || "video.mp4";
if (!fs.existsSync(VIDEO)) { console.error("❌ No existe el video:", VIDEO); process.exit(1); }
const RAW = (process.env.BILIBILI_COOKIE || "").trim();
const TITLE = (process.env.BILI_TITLE || "Untitled").slice(0, 80);
const DESC = process.env.BILI_DESC || "";
const TAGS = (process.env.BILI_TAG || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
const UPLOAD_URL = process.env.BILI_UPLOAD_URL || "https://member.bilibili.com/platform/upload/video/frame";

const m = {}; RAW.split(/;\s*/).forEach((p) => { const i = p.indexOf("="); if (i > 0) m[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
const names = ["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5"];
const miss = names.filter((n) => !m[n]);
if (miss.length) { console.error("❌ Faltan cookies en BILIBILI_COOKIE:", miss.join(", ")); process.exit(1); }
const cookies = names.map((n) => ({ name: n, value: m[n], domain: ".bilibili.com", path: "/", httpOnly: false, secure: true }));

fs.mkdirSync("shots", { recursive: true });
let step = 0;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: "en-US" });
await ctx.addCookies(cookies);
const page = await ctx.newPage();
page.setDefaultTimeout(45000);
const shot = async (label) => { const n = `${String(++step).padStart(2, "0")}_${label}`; try { await page.screenshot({ path: `shots/${n}.png`, fullPage: false }); console.log("📸", n); } catch {} };
const log = (...a) => console.log(...a);

try {
  log("→ Abriendo Bilibili Studio:", UPLOAD_URL);
  await page.goto(UPLOAD_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);
  await shot("open");
  // Guardar el DOM para poder afinar selectores desde el artefacto.
  try { fs.writeFileSync("page.html", await page.content()); } catch {}

  // ¿Nos reconoció la cookie? (si nos manda a login, la cookie no sirvió)
  if (/passport\.bilibili\.com|\/login/i.test(page.url())) { console.error("❌ Redirigió a login — la cookie no autenticó. URL:", page.url()); await shot("login_redirect"); await browser.close(); process.exit(2); }

  // 1) Seleccionar el archivo (el <input type=file> puede estar oculto).
  log("→ Buscando el input de archivo…");
  const fileInput = await page.waitForSelector('input[type="file"]', { state: "attached", timeout: 45000 });
  await fileInput.setInputFiles(VIDEO);
  log("✅ Archivo seleccionado, subiendo…");
  await page.waitForTimeout(4000);
  await shot("uploading");

  // 2) Esperar a que termine la subida (aparece el editor de datos / desaparece la barra).
  //    Señales típicas: texto de progreso 100%, o que ya podamos escribir el título.
  const deadline = Date.now() + 8 * 60 * 1000; // hasta 8 min
  let ready = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(6000);
    const txt = (await page.locator("body").innerText().catch(() => "")) || "";
    if (/上传完成|Upload complete|100%|投稿|Publish|Submit/i.test(txt)) { ready = true; }
    // ¿Ya hay un campo de título editable?
    const hasTitle = await page.locator('input[maxlength], input[placeholder*="标题"], input[placeholder*="itle"], textarea[placeholder*="itle"]').count().catch(() => 0);
    if (ready || hasTitle) { await shot("upload_done"); break; }
  }

  // 3) Título: normalmente se auto-rellena con el nombre del archivo; lo reemplazamos.
  log("→ Poniendo título…");
  const titleSel = ['input[placeholder*="标题"]', 'input[placeholder*="itle"]', 'input[maxlength="80"]', 'input[maxlength="40"]'];
  for (const s of titleSel) { const el = page.locator(s).first(); if (await el.count().catch(() => 0)) { await el.click({ timeout: 5000 }).catch(() => {}); await el.fill("").catch(() => {}); await el.type(TITLE, { delay: 20 }).catch(() => {}); break; } }
  await shot("title");

  // 4) Tags (si hay campo).
  if (TAGS.length) {
    const tagSel = ['input[placeholder*="标签"]', 'input[placeholder*="ag"]'];
    for (const s of tagSel) { const el = page.locator(s).first(); if (await el.count().catch(() => 0)) { for (const t of TAGS) { await el.type(t, { delay: 20 }).catch(() => {}); await page.keyboard.press("Enter").catch(() => {}); await page.waitForTimeout(300); } break; } }
    await shot("tags");
  }

  // 5) Descripción (opcional).
  if (DESC) { const d = page.locator('textarea[placeholder*="简介"], textarea[placeholder*="escription"]').first(); if (await d.count().catch(() => 0)) { await d.fill(DESC).catch(() => {}); } }

  // 5b) 创作声明 (Declaración de autoría) — OBLIGATORIO. Abrir el dropdown, ver opciones y elegir una.
  log("→ Declaración de autoría (创作声明)…");
  const declTrigger = page.locator('input[placeholder*="创作声明"], input[placeholder*="创作声"]').first();
  if (await declTrigger.count().catch(() => 0)) {
    await declTrigger.scrollIntoViewIfNeeded().catch(() => {});
    await declTrigger.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot("decl_open");
    const opts = await page.locator('.el-select-dropdown__item, li[class*="option"], [class*="select-dropdown"] li, [class*="option-item"]').allInnerTexts().catch(() => []);
    log("创作声明 opciones:", JSON.stringify(opts));
    // Preferir "无"/"none"/"原创"/"自制"; si no, la primera opción real.
    const pref = ["无以上", "无", "none", "原创", "自制", "self"];
    let picked = false;
    for (const p of pref) { const el = page.locator(`.el-select-dropdown__item:has-text("${p}"), li:has-text("${p}")`).first(); if (await el.count().catch(() => 0)) { await el.click().catch(() => {}); picked = true; log("创作声明 elegido:", p); break; } }
    if (!picked) { const first = page.locator('.el-select-dropdown__item, li[class*="option"]').first(); if (await first.count().catch(() => 0)) { await first.click().catch(() => {}); log("创作声明: elegí la 1ª opción"); } }
    await page.waitForTimeout(800);
    await shot("decl_selected");
  } else { log("⚠️ No encontré el dropdown de 创作声明 (quizá ya no es obligatorio)"); }

  await shot("before_submit");
  // 6) Enviar. Botón PRECISO (el real, abajo), scroll + click; luego posible diálogo de confirmación.
  log("→ Enviando…");
  let submitted = false;
  const submitBtn = page.locator('button:has-text("立即投稿"), span:has-text("立即投稿")').last();
  if (await submitBtn.count().catch(() => 0)) {
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    await submitBtn.click({ force: true, timeout: 8000 }).catch(() => {});
    submitted = true; log("click: 立即投稿");
  }
  await page.waitForTimeout(2500);
  await shot("after_click");
  // Diálogo de confirmación (si aparece).
  for (const c of ['button:has-text("确定")', 'button:has-text("确认")', 'button:has-text("继续投稿")', 'button:has-text("继续")', 'button:has-text("知道了")']) {
    const el = page.locator(c).last();
    if ((await el.count().catch(() => 0)) && (await el.isVisible().catch(() => false))) { await el.click().catch(() => {}); log("confirm:", c); await page.waitForTimeout(2000); break; }
  }
  // 7) Esperar éxito: modal "投稿成功" / texto de revisión / cambio de URL.
  let ok = false;
  const t2 = Date.now() + 70000;
  while (Date.now() < t2) {
    await page.waitForTimeout(3000);
    const txt = (await page.locator("body").innerText().catch(() => "")) || "";
    if (/投稿成功|稿件.*成功|提交.*审核|投递成功|Submitted|success/i.test(txt)) { ok = true; break; }
    if (/success|manuscript|content\/manuscript|\/upload\/video\/frame\?.*success/i.test(page.url())) { ok = true; break; }
    // ¿desapareció el botón de投稿 y aparecieron los datos del稿件? (otra señal de éxito)
    const stillForm = await page.locator('button:has-text("立即投稿")').count().catch(() => 0);
    if (!stillForm && /内容管理|稿件管理|My content/i.test(txt)) { ok = true; break; }
  }
  await shot("final");

  const finalTxt = (await page.locator("body").innerText().catch(() => "")) || "";
  if (!ok) ok = /投稿成功|稿件投递成功|Submitted|审核中|review/i.test(finalTxt);
  try { fs.writeFileSync("result.txt", (ok ? "OK" : "UNKNOWN") + "\nsubmitted=" + submitted + "\nurl=" + page.url()); } catch {}
  if (ok) { log("✅ Parece enviado correctamente (revisa el canal / en revisión)."); }
  else { log("⚠️ No confirmé el éxito por texto. Revisa las capturas en shots/ y result.txt."); }
  await browser.close();
  process.exit(ok ? 0 : 3);
} catch (e) {
  console.error("❌ Error:", e && e.message ? e.message : e);
  await shot("error");
  try { fs.writeFileSync("page.html", await page.content()); } catch {}
  await browser.close();
  process.exit(1);
}
