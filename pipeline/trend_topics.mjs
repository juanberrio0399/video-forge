#!/usr/bin/env node
// Temas en tendencia en OTROS paises (Rusia, Japon, Corea, Brasil, India...) para Oddly Loop.
// Juan, 26-nov: "un perrito bailando, un atardecer: cosas que no necesitan idioma y traen publico".
// CAMINO SEGURO: de las tendencias se toma solo el TEMA (perros, atardeceres, nieve...). El video NUNCA se baja de
// YouTube: el tema se busca en Pexels/Pixabay (licencia libre) con clip_pexels.yml / clip_pixabay.yml.
// Los titulos vienen en muchos idiomas: el diccionario TEMAS trae cada tema en varios idiomas (esa es la "traduccion").
//
// Uso: node pipeline/trend_topics.mjs [usados.json] [cuantos]   -> imprime JSON [{tema, query, puntos, paises}]
// Necesita YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (1 unidad de cuota por lista).
import fs from "node:fs";

// pais -> peso (mercados grandes y con contenido visual fuerte)
export const REGIONES = { RU: 1.0, JP: 1.0, KR: 0.9, BR: 0.9, IN: 0.8, ID: 0.7, TR: 0.7, DE: 0.7, FR: 0.7, US: 1.0, GB: 0.8, VN: 0.6, TH: 0.6 };
// categorias de YouTube sin idioma: 15 mascotas y animales, 19 viajes y eventos (paisajes)
export const CATEGORIAS = ["15", "19"];
export const DIAS_SIN_REPETIR = 5;

// tema -> busqueda en el stock + palabras en varios idiomas (en, es, pt, ru, ja, ko, tr, de, fr, id, vi, th, hi)
export const TEMAS = {
  "perros": { query: "funny dog", palabras: ["dog", "puppy", "doggo", "perro", "perrito", "cachorro", "собака", "собак", "щенок", "пёс", "犬", "わんこ", "子犬", "강아지", "köpek", " hund ", "chien", "anjing", "chó", "สุนัข", "หมา", "कुत्ता"] },
  "gatos": { query: "funny cat", palabras: [" cat ", " cats ", "kitten", "kitty", "gato", "gatito", " кот ", " коты ", "кошк", "котён", "котик", "котёнок", "猫", "ねこ", "ネコ", "子猫", "고양이", "냥", "kedi", "katze", "chat ", "kucing", "mèo", "แมว", "बिल्ली"] },
  "animales bebe": { query: "baby animals", palabras: ["baby animal", " cub ", "bebé", "filhote", "детёныш", "赤ちゃん", "아기", "yavru", "jungtier", "bébé"] },
  "pajaros": { query: "parrot bird", palabras: ["bird", "parrot", "pájaro", "loro", "pássaro", "papagaio", "птиц", "попуга", "鳥", "インコ", "새 ", "앵무", "kuş", "vogel", "oiseau", "burung", "chim"] },
  "caballos": { query: "horse", palabras: ["horse", "caballo", "cavalo", "лошад", "конь", "馬", "pferd", "cheval", "kuda", "ngựa"] },
  "osos y pandas": { query: "panda bear", palabras: ["panda", " bear", "oso", "urso", "медвед", "パンダ", "クマ", "곰", "판다", "ayı", "bär", "ours", "beruang", "gấu"] },
  "oceano": { query: "ocean waves", palabras: ["ocean", " sea ", "beach", "wave", "océano", " mar ", "playa", "praia", "море", "океан", "пляж", "海", "ビーチ", "바다", "해변", "deniz", "meer", "strand", "plage", "laut", "pantai", "biển", "ทะเล"] },
  "atardeceres": { query: "sunset timelapse", palabras: ["sunset", "sunrise", "atardecer", "amanecer", "pôr do sol", "закат", "рассвет", "夕日", "夕焼け", "朝日", "노을", "일몰", "일출", "gün batımı", "sonnenuntergang", "coucher de soleil", "matahari terbenam", "hoàng hôn"] },
  "nieve": { query: "snow winter", palabras: ["snow", "winter", "nieve", "invierno", "neve", "inverno", "снег", "зима", "雪", "冬", "눈 ", "겨울", "kar ", "kış", "schnee", "neige", "salju", "tuyết"] },
  "montanas": { query: "mountain landscape drone", palabras: ["mountain", "montaña", "montanha", " гор ", "горы", "산 ", "dağ", " berg ", "montagne", "gunung", "núi"] },
  "ciudades de noche": { query: "city night timelapse", palabras: ["city night", "night view", "noche", "cidade", "ночн", "夜景", "야경", "gece", "nacht", "nuit", "malam", "đêm"] },
  "lluvia y tormentas": { query: "rain storm lightning", palabras: [" rain ", "storm", "lightning", "lluvia", "tormenta", "chuva", "дожд", "гроз", "молни", "雨", "雷", "폭풍", "yağmur", "regen", "pluie", "hujan", "mưa"] },
  "aurora y cielo": { query: "aurora night sky stars", palabras: ["aurora", "northern lights", "milky way", "stars", "estrellas", "северное сияние", "звёзд", "オーロラ", "星空", "오로라", "별", "kuzey ışıkları", "polarlicht"] },
  "bosques y cascadas": { query: "waterfall forest", palabras: ["waterfall", "forest", "cascada", "bosque", "cachoeira", "floresta", "водопад", " лес ", "滝", "폭포", "숲", "şelale", "orman", "wasserfall", "wald", "cascade", "forêt", "air terjun", "thác"] },
};

// Cuantos puntos da cada tema: por cada video en tendencia que lo nombra, peso del pais * (1 - posicion/50).
export function puntuar(listas) {
  const salida = {};
  for (const { pais, titulos } of listas) {
    const peso = REGIONES[pais] ?? 0.5;
    titulos.forEach((t, pos) => {
      const texto = ` ${String(t || "").toLowerCase()} `;
      for (const [tema, { palabras }] of Object.entries(TEMAS)) {
        if (palabras.some((p) => texto.includes(p.toLowerCase()))) {
          const s = (salida[tema] ??= { tema, query: TEMAS[tema].query, puntos: 0, paises: [] });
          s.puntos += peso * (1 - pos / 50);
          if (!s.paises.includes(pais)) s.paises.push(pais);
        }
      }
    });
  }
  return Object.values(salida)
    .map((s) => ({ ...s, puntos: Math.round(s.puntos * 100) / 100 }))
    .sort((a, b) => b.puntos - a.puntos);
}

// Los mejores temas que no se usaron en los ultimos DIAS_SIN_REPETIR dias. usados: {tema: "YYYY-MM-DD"}
export function elegir(ranking, usados = {}, cuantos = 2, hoy = new Date()) {
  const limite = hoy.getTime() - DIAS_SIN_REPETIR * 86400000;
  const libres = ranking.filter((r) => !usados[r.tema] || new Date(usados[r.tema]).getTime() < limite);
  return libres.slice(0, cuantos);
}

async function token() {
  const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("token: sin access_token");
  return j.access_token;
}

async function loMasVisto(pais, categoria, pase) {
  const q = new URLSearchParams({ part: "snippet", chart: "mostPopular", regionCode: pais, videoCategoryId: categoria, maxResults: "50" });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?${q}`, { headers: { authorization: `Bearer ${pase}` } });
  if (!r.ok) return [];          // hay paises sin lista para esa categoria: se sigue con los demas
  const j = await r.json();
  return (j.items || []).map((v) => `${v.snippet?.title || ""} ${(v.snippet?.tags || []).join(" ")}`);
}

async function main() {
  const [rutaUsados, cuantos = "2"] = process.argv.slice(2);
  let usados = {};
  try { usados = rutaUsados ? JSON.parse(fs.readFileSync(rutaUsados, "utf8")) : {}; } catch { usados = {}; }
  const pase = await token();
  const listas = [];
  for (const pais of Object.keys(REGIONES)) {
    for (const cat of CATEGORIAS) listas.push({ pais, titulos: await loMasVisto(pais, cat, pase) });
  }
  const ranking = puntuar(listas);
  console.error("Ranking:", ranking.map((r) => `${r.tema} ${r.puntos} (${r.paises.join(",")})`).join(" | "));
  process.stdout.write(JSON.stringify(elegir(ranking, usados, Number(cuantos))));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("trend_topics.mjs")) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
