---
name: video-tendencias
description: Investiga tendencias y VALIDA la demanda de un tema para el canal de datos (faceless, YouTube) antes de producir. Usar SIEMPRE al inicio para elegir/aprobar un tema. Entrega un veredicto GO/NO-GO con evidencia de demanda y hueco de oferta, y semillas de temas.
---

# video-tendencias

Investigador de demanda del canal. Antes de producir, confirmas que un tema **ya
tiene demanda comprobada** y **poca oferta reciente** (hueco). Regla de oro:
**demanda comprobada + oferta escasa**. Mucha demanda + mucha oferta = saturado;
poca demanda = no importa lo original que seas.

## Metodo paso a paso (idear -> validar)

1. **Ideacion (que habla la gente):** corre `/last30days "<tema>"` (Reddit/HN/
   YouTube/arXiv rankeado por engagement real). Barre subreddits del nicho
   (r/dataisbeautiful, r/economics, r/geopolitics) y Google News por el angulo.
2. **Lenguaje real:** teclea el tema en la **barra de YouTube** y anota TODO el
   autocomplete (queries reales). Refuerza con Answer the Public (3/dia) y Ahrefs
   Free Keyword Generator (150 ideas + 50 preguntas).
3. **Volumen/tendencia:** Google Trends con filtro **"YouTube Search"** (no Web):
   confirma interes estable/al alza (evergreen), no moda muerta. Compara variantes.
4. **Demanda dentro de YouTube:** YouTube Studio -> Analytics -> **Research (Trends)**:
   volumen (high/med/low) y sobre todo etiquetas **"Content Gap"** = gente busco y
   no encontro buen video. Oro.
5. **Saturacion / hueco (outlier gap):** busca el tema en YouTube, ordena por mes/
   año. GO si hay **outliers** (vistas >> tamaño del canal) PERO poca oferta reciente
   y de calidad. vidIQ Free muestra score y vistas de la competencia.
6. **Patron de titulo:** de los 3-5 outliers saca el patron que se repite (numero
   que sorprende, "How X actually works", "The real reason...") y clonalo sin copiar.
7. **Decision GO/NO-GO** con el checklist.

## Tabla de herramientas (que da gratis)

| Herramienta | Gratis | Para que |
|---|---|---|
| last30days-skill | Reddit, HN, GitHub, arXiv, Polymarket sin key | Ideacion por engagement real |
| YouTube autocomplete | Todo | Queries reales que la gente teclea |
| YouTube Studio Research/Trends | Volumen + **Content Gap** | Validacion dentro de YouTube |
| Google Trends (filtro YouTube Search) | Todo | Tendencia, evergreen vs moda |
| vidIQ Free | Overlay competencia, scorecard, vistas | Rendimiento competencia + score keyword |
| Ahrefs Free Keyword Generator | 150 kw + 50 preguntas, KD top 10 | Expansion de keywords |
| Answer the Public | 3 busquedas/dia | Preguntas del publico |
| OutlierKit | Free tier outlier finder | Automatiza gap/outlier analysis |

Combo cero-costo: **vidIQ Free + Google Trends + YouTube Studio Research + last30days.**

## Checklist GO / NO-GO

GO si cumple la mayoria:
- [ ] Autocomplete de YouTube lo sugiere solo (demanda real).
- [ ] Google Trends (YouTube Search) plano o al alza 12-24 meses, o pico sostenido.
- [ ] Studio Research: aparece como Content Gap o volumen medium/high.
- [ ] Hay outliers (vistas >> tamaño del canal): el tema puede volar sin audiencia.
- [ ] Poca oferta reciente y de calidad (huecos, videos viejos/malos arriba).
- [ ] Curiosity gap + un numero que sorprende.
- [ ] Se puede contar SOLO con datos/visuales (faceless).

NO-GO si: primera pagina llena de canales grandes con videos frescos y buenos;
Trends en caida; nadie lo busca; o depende de personalidad/cara.

## Semillas de temas (pasan primer filtro; validar antes de producir)

Finanzas/negocios (CPM alto) y datos del mundo, faceless-friendly:
1. "Where does your tax money actually go?"
2. "How much is $1 trillion, really?" (escala visual)
3. "The real reason [pais] is so rich/poor"
4. "How [empresa] quietly went bankrupt" (case study)
5. "Every country's debt, visualized" (bar chart race)
6. "What the average salary buys around the world"
7. "The math behind why you can't get rich" (interes compuesto)
8. "How the internet actually works" (cables submarinos, infraestructura)

## Recursos GRATIS

- last30days-skill: https://github.com/mvanhorn/last30days-skill
- YouTube Research/Trends: https://support.google.com/youtube/answer/11962757 · https://www.socialmediaexaminer.com/youtube-research-tab-how-to-find-youtube-content-ideas/
- Keyword research: https://outlierkit.com/resources/youtube-keyword-research/ · https://ahrefs.com/blog/free-keyword-research-tools/
- Outlier / gap analysis: https://outlierkit.com/blog/best-youtube-outlier-finder-tools · https://www.overseeros.com/blog/youtube-outlier-analysis
- Nichos faceless + CPM: https://outlierkit.com/resources/faceless-youtube-channels/ · https://tubelab.net/blog/faceless-youtube-channel-niches
