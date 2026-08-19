# Oddly Clipper — 2º puente de creación (local, gratis)

Toma videos **largos con licencia Creative Commons (CC-BY)** de YouTube, los **edita profesionalmente**
(reencuadre 9:16, subtítulos animados) usando **solo el contenido del propio video** (nada externo) y los deja **privados en Oddly Loop**
para que **tú apruebes desde el bot de Telegram** si se publican o no.

Corre **100% local en tu PC** (por eso puede descargar de YouTube, cosa que la nube bloquea). Todo
lo que usa es **gratis**. Es la carpeta **`clipper/` dentro del repo `video-forge`** — el MISMO repo
hace la nube (lo automático) y lo local (esto). Al clonar video-forge en cualquier PC, funciona igual.

> **No afecta lo automático de `video-forge`.** Es una carpeta aparte (`clipper/`); no toca los
> workflows ni el código del sistema en la nube. Lo único que comparte es el destino: sube a
> **Oddly Loop** con una **categoría distinta (`Clips CC`)** para medir su resultado aparte.

---

## Cómo funciona (el flujo)

```
1. DESCARGA (local, yt-dlp)      → baja el video CC + verifica que la licencia sea CC-BY
2. ANÁLISIS (Whisper + Gemini)   → transcribe y la IA elige los MEJORES momentos (hooks, giros)
3. EDICIÓN PRO (ffmpeg)          → recorta el momento, reencuadra 9:16, subtítulos karaoke (solo el video CC)
4. QA                            → valida duración, formato 9:16, subtítulos, atribución CC, archivo OK
5. PUBLICAR (privado a Oddly)    → sube PRIVADO a Oddly Loop (YT2) + categoría "Clips CC" + avisa al bot
6. TÚ APRUEBAS en el bot         → publicar / programar / descartar (flujo que ya tienes)
```

**Auto-detección de hardware:** al ejecutar, mide si el PC tiene **GPU NVIDIA (CUDA)** o solo **CPU** y
ajusta solo el modelo de Whisper y la velocidad. Así corre bien en tu PC actual (CPU) y en el otro (GPU).

---

## Requisitos (una sola vez por PC)

- **Python 3.10+** — https://www.python.org/downloads/ (marca "Add to PATH")
- **ffmpeg** — el `setup` lo instala/verifica
- **VS Code** — https://code.visualstudio.com/
- Credenciales en `.env` (ver abajo) — **NUNCA se suben a GitHub**

---

## Puesta en marcha (paso a paso — sirve en CUALQUIER PC)

### 1) Clonar video-forge e ir a la carpeta del clipper
```powershell
cd $HOME\Documents
git clone https://github.com/juanberrio0399/video-forge.git
cd video-forge\clipper
```

### 2) Setup (una vez) — instala todo lo gratis
```powershell
.\setup.ps1
```
Esto crea el entorno de Python, instala dependencias (yt-dlp, faster-whisper, etc.), verifica ffmpeg
y detecta tu hardware.

### 3) Poner las credenciales
Copia `.env.example` a `.env` y llena tus claves (todas de planes gratis):
```powershell
Copy-Item .env.example .env
```
- `YT2_CLIENT_ID / YT2_CLIENT_SECRET / YT2_REFRESH_TOKEN` — para subir a Oddly Loop
- `GEMINI_API_KEY` — elegir los mejores momentos (plan gratis)
- `R2_*` + `TELEGRAM_*` — para avisar al bot

### 4) Crear el acceso en el Escritorio (una vez)
```powershell
.\scripts\crear_acceso_escritorio.ps1
```
Deja en tu **Escritorio** el archivo **`Oddly Clipper.code-workspace`**. Doble clic → abre VS Code
en el repo, listo para correr.

### 5) Correr (el día a día)
Abre el workspace del Escritorio en VS Code y:
- **Terminal → Run Task → «▶ Correr Oddly Clipper»**  (o en la terminal: `.\run.ps1`)

Te va mostrando el paso a paso. Al final, el Short queda **privado en Oddly Loop** y te llega un
aviso al **bot de Telegram** para aprobarlo.

---

## Config (`config.json`)

- `sources`: URLs de videos CC (o una búsqueda de temas) a procesar.
- `clips_per_video`: cuántos Shorts sacar de cada largo.
- `categoria`: la etiqueta con la que se mide aparte (por defecto `Clips CC`).
- `duracion_short`: rango de segundos del Short.

---

## Reproducir en otro PC

Es el mismo paso a paso de arriba (clonar → `setup.ps1` → `.env` → correr). Todo el código y la
config viven en GitHub; lo único que NO viaja es el `.env` (tus claves), que llenas en cada PC.

---

## Qué NO hace / reglas

- **Solo videos CC-BY** (verifica la licencia). Siempre pone **atribución** al autor en la descripción.
- No toca nada de `video-forge` (lo automático sigue igual).
- Si el PC no tiene GPU, usa un modelo de Whisper más liviano para no tardar demasiado.
