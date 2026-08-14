# Plan de Difusión — video-forge

Este documento contiene todo el material redactado y listo para copiar, pegar y lanzar manualmente por Juan. Ninguna acción de difusión está automatizada.

---

## 1. Show HN (Hacker News)

* **Reglas clave:** Título plano y descriptivo (nada de clickbait ni exageraciones). El repo debe ser abierto e inspeccionable (lo cumple). Responder a los comentarios de forma humana, técnica y transparente (sin pedir upvotes ni usar texto generado).
* **Mejor momento para publicar:** Martes, miércoles o jueves entre las 8:00 AM y las 10:00 AM PT.

### Título
text
Show HN: video-forge – $0 cloud factory that produces & schedules YouTube videos


### Texto / URL
*(Enviar como enlace principal apuntando al repositorio de GitHub)*

text
Hi HN,

I built video-forge, an open-source, 100% cloud-based video production factory designed to run completely free using GitHub Actions, Cloudflare Workers, R2, and local/free AI models (Gemini, Kokoro TTS, HyperFrames).

What makes it different:
- Zero local rendering: everything runs via serverless cron jobs and CI runners.
- Operates two distinct channels independently (one for data/finance essays, one for automated ASMR/compilations).
- Controlled on the go through a Telegram Mini App.
- Self-hosted state and scheduling based on historical viewer analytics.

It's fully open-source, inspectable, and self-hostable. I'm building this to test how far $0 cloud infra can go for automated media pipelines. Curious to hear your thoughts, feedback, or critiques on the architecture!


---

## 2. Dev.to (Artículo)

* **Enfoque:** Guía técnica / arquitectura sobre cómo montar una fábrica de contenido automatizada en la nube gastando $0 en servidores.

### Título
text
Building a $0 Cloud Video Factory with GitHub Actions, Cloudflare, and AI


### Outline / Ganchos
1. **Hook:** Los costos de infraestructura para automatizar video suelen ser prohibitivos (GPUs dedicadas, instancias EC2 pesadas). ¿Y si usamos CI/CD gratuito y edge computing?
2. **Arquitectura:** 
   - GitHub Actions como motor pesado de render (HyperFrames / ffmpeg).
   - Cloudflare Workers + R2 como cerebro y base de datos liviana.
   - Modelos de voz (Kokoro) e inteligencia artificial (Gemini) orquestados en paralelo.
3. **Control Remoto:** Cómo integrar una Telegram Mini App para aprobar y gestionar los videos desde el móvil sin abrir una terminal.
4. **Retos y Lecciones Aprendidas:** Manejo de límites de tiempo en CI, gestión de estado distribuido y control de compliance para fuentes CC0.
5. **Conclusión y llamada a la acción:** Enlace al repositorio open-source para que cualquiera pueda clonarlo y levantar su propia fábrica.

---

## 3. Subreddits

### A. r/selfhosted
* **Ángulo:** Enfoque en la auto-hospedabilidad, control de datos, arquitectura serverless y uso ingenioso de GitHub Actions y Cloudflare R2 sin mantenimientos de servidores dedicados.

**Copy:**
text
[Shared] video-forge: A self-hosted, $0 cloud video factory running on GitHub Actions & Cloudflare

Hey everyone,

I wanted to share a project I've been working on: a modular pipeline that automatically scripts, voices, renders, and schedules YouTube videos entirely in the cloud for $0/month.

Stack:
- GitHub Actions (for heavy lifting / rendering via HyperFrames & ffmpeg)
- Cloudflare Workers + R2 (as state manager & API backend)
- Telegram Mini App (to review, approve, and check analytics on mobile)
- Free-tier / local AI models (Gemini for scripts/SEO, Kokoro for TTS)

Everything is fully open-source and modular. If you like self-hosting unorthodox things or combining CI pipelines into creative tools, check it out and let me know what you think!

Repo: https://github.com/owner/video-forge


### B. r/SideProject
* **Ángulo:** Mostrar el proyecto como un side-project completo que resuelve un problema real (automatización de canales de YouTube) combinando tecnologías modernas de forma creativa.

**Copy:**
text
I built an open-source YouTube factory that runs 100% in the cloud for free (GitHub Actions + Cloudflare + Telegram)

Hi r/SideProject,

Like many, I wanted to explore automated content creation, but didn't want to pay hundreds for cloud rendering instances or keep a PC running 24/7. So I built video-forge.

It handles two separate channels autonomously—one focused on data essays (with human-in-the-loop approval via a Telegram Mini App) and another doing full-auto ASMR/compilation blitzes.

It features automated script generation, parallel text-to-speech (Kokoro), phase-based rendering, compliance checks for CC0 assets, and smart scheduling based on channel analytics.

Would love your feedback on the readme, architecture, or overall concept!

Repo: https://github.com/owner/video-forge


### C. r/NewTubers
* **Ángulo:** Enfocado en la optimización de flujos de trabajo, consistencia de publicación y cómo la automatización bien hecha ayuda a mantener la constancia sin descuidar el control de calidad.

**Copy:**
text
[Tool] Built an open-source tool to help manage and automate faceless YouTube pipelines at $0 cost

Hey creators,

Consistency is the hardest part of running faceless channels. I built an open-source, self-hosted system called video-forge to handle the heavy lifting: automated research/scripts, voice synthesis, video assembly, compliance checks, and best-time scheduling.

It includes a Telegram Mini App so you can review generated drafts before publishing, keeping human oversight while automating the repetitive parts. It runs entirely on free cloud tiers (GitHub Actions + Cloudflare).

It's 100% open-source if you want to inspect how it works or run your own instance. Happy to answer any questions about the workflow!

Repo: https://github.com/owner/video-forge


---

## 4. Awesome-Lists (Candidatas)

Lista de repositorios curados donde proponer el proyecto mediante Pull Request:

1. **Awesome Cloudflare Workers**
   - **URL:** https://github.com/irazasyed/awesome-cloudflare
   - **Cómo contribuir:** Agregar bajo la sección de proyectos Open Source / Apps.
   - **Entrada sugerida:** `- [video-forge](https://github.com/owner/video-forge) - A $0 cloud video production factory controlled via Cloudflare Workers, R2, and Telegram Mini Apps.`

2. **Awesome GitHub Actions**
   - **URL:** Buscar listas populares de workflows y automatizaciones en GitHub.
   - **Entrada sugerida:** `- [video-forge](https://github.com/owner/video-forge) - Orchestrate complex media rendering and publishing pipelines entirely inside GitHub Actions CI runners.`

3. **Awesome Self-Hosted**
   - **URL:** https://github.com/awesome-selfhosted/awesome-selfhosted
   - **Entrada sugerida:** `- [video-forge](https://github.com/owner/video-forge) - Cloud-based automated video factory with Telegram mobile management.`

---

## 5. Checklist de Lanzamiento

- [ ] Verificar que el `README.md` principal esté actualizado y luzca como un showcase impecable.
- [ ] Comprobar que las claves y secretos en el repo propio no estén expuestos.
- [ ] Publicar **Show HN** en martes/miércoles/jueves (8:00 AM - 10:00 AM PT).
- [ ] Estar atento a la sección de comentarios de HN durante las primeras 3 horas para responder con amabilidad y rigor técnico.
- [ ] Publicar en `r/selfhosted` y `r/SideProject` con un par de horas de diferencia.
- [ ] Enviar PRs a las awesome-lists seleccionadas una vez pasado el pico inicial de tráfico.
