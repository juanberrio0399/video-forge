# Guía para trabajar en este repo

video-forge es una fábrica de videos de YouTube que corre en GitHub Actions y Cloudflare.
El README explica el sistema; esto es lo que hay que saber antes de tocar código.

## Reglas del repo

- **El repo es público.** Ningún secreto, token ni archivo personal entra aquí. La voz de
  referencia vive en R2 privado y `.gitignore` bloquea `assets/voice/*.mp3`.
- **Un cambio en producción se refleja en el repo en el mismo movimiento.** Si se arregla algo
  desde la consola de Cloudflare o de GitHub, el archivo correspondiente se actualiza igual.
- **La lógica de decisión va en `pipeline/lib/` y es pura** (sin red ni disco) para que tenga test.
  Los scripts de `pipeline/` hacen la E/S y llaman a `lib/`.
- **Cada script y cada workflow abre con un comentario** de qué hace y cuándo corre. Los
  comentarios explican el porqué (la restricción, la decisión, el detalle que muerde), no el qué.
- **Nada se aprueba solo en The Data Lens.** Sus videos quedan privados hasta que Juan aprueba
  desde la Mini App. Oddly Loop sí publica solo, pero pasa por `compliance_check.mjs`.

## Antes de abrir un PR

```bash
npm install
npm test                                 # vitest sobre pipeline/lib (tests.yml)
node --check <archivo.mjs>               # lo mismo que valida build-check.yml
```

`build-check.yml` también valida el JS del cliente de la Mini App. Ese JS vive **dentro** de un
template-literal en `bot/src/miniapp*.js`, así que no puede usar template-literals ni `onclick`
inline: rompe el template exterior.

## Composición HyperFrames (el render de The Data Lens)

`index.html` es la composición raíz; `projects/` guarda guion y storyboard, y `meta.json` /
`hyperframes.json` la configuración. La versión del CLI está clavada en `package.json` para que el
mismo proyecto vuelva a renderizar igual meses después.

```bash
npm run check        # lint + runtime + layout + motion + contrast
npm run dev          # servidor de preview — queda corriendo, lánzalo en segundo plano
npm run render       # renderiza a MP4
npx hyperframes docs <topic>   # referencia local: data-attributes, gsap, compositions, rendering
```

Reglas de la composición que no se pueden saltar:

1. Todo elemento con tiempo lleva `data-start`, `data-duration`, `data-track-index` y `class="clip"`
   (el framework usa esa clase para controlar visibilidad).
2. Las timelines se registran pausadas en `window.__timelines["<id>"]`.
3. Los videos van `muted` con un `<audio>` aparte para la pista de audio.
4. Las sub-composiciones se referencian con `data-composition-src="compositions/archivo.html"`.
5. Solo lógica determinista: sin `Date.now()`, sin `Math.random()`, sin fetch. El render debe dar el
   mismo resultado en cada corrida.

Subir la versión del CLI: `npx hyperframes@latest upgrade --project . --check` para ver el delta y
luego sin `--check` para reescribir los pines.
