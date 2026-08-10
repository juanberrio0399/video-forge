// set_channel_branding.mjs — aplica la MARCA del canal por API (YT2 mapeado a YT_*):
// sube el BANNER, y fija descripcion + keywords + pais + idioma. El AVATAR no se puede por API
// (lo sube Juan a mano). Preserva el resto de brandingSettings (no borra el titulo, etc.).
// Uso: node pipeline/set_channel_branding.mjs <channel.json> [banner.png]
import fs from "node:fs";

const [cfgPath, bannerPath] = process.argv.slice(2);
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

const tr = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }) })).json();
const T = tr.access_token; if (!T) { console.error("no token"); process.exit(1); }
const H = { Authorization: `Bearer ${T}` };

// 1) Canal actual (id + brandingSettings actuales para no borrar nada).
const chr = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=brandingSettings,snippet&mine=true", { headers: H })).json();
const ch = (chr.items || [])[0]; if (!ch) { console.error("sin canal"); process.exit(1); }
const id = ch.id;
const bs = ch.brandingSettings || {}; bs.channel = bs.channel || {}; bs.image = bs.image || {};

// 2) Subir banner (si se paso). channelBanners.insert -> url, y se referencia en image.bannerExternalUrl.
if (bannerPath && fs.existsSync(bannerPath)) {
  const bytes = fs.readFileSync(bannerPath);
  const up = await fetch("https://www.googleapis.com/upload/youtube/v3/channelBanners/insert?uploadType=media", { method: "POST", headers: { ...H, "content-type": "image/png" }, body: bytes });
  const uj = await up.json();
  if (uj.url) { bs.image.bannerExternalUrl = uj.url; console.log("banner subido"); }
  else console.error("banner no subido:", JSON.stringify(uj).slice(0, 300));
}

// 3) Descripcion + keywords + pais + idioma.
if (cfg.description != null) bs.channel.description = cfg.description;
if (cfg.keywords != null) bs.channel.keywords = cfg.keywords;
if (cfg.country != null) bs.channel.country = cfg.country;
if (cfg.defaultLanguage != null) bs.channel.defaultLanguage = cfg.defaultLanguage;

const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=brandingSettings", { method: "PUT", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ id, brandingSettings: bs }) });
const rj = await r.json();
if (r.ok) console.log(`OK marca aplicada: descripcion + tags${bs.image.bannerExternalUrl ? " + banner" : ""}.`);
else { console.error("channels.update fallo:", JSON.stringify(rj).slice(0, 400)); process.exit(1); }
