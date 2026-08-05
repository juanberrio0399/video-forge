# Guía: crear el 2º canal de YouTube + OAuth (canal automático)

Acción **manual de Juan** (una sola vez). Reutiliza el mismo proyecto de Google Cloud y el mismo cliente OAuth del canal actual; solo se crea el canal nuevo y se saca un **refresh token nuevo** autorizando ese 2º canal. La app OAuth ya está "In production", así que el token **no caduca**.

Al final quedan 3 secrets nuevos en GitHub: `YT2_CLIENT_ID`, `YT2_CLIENT_SECRET`, `YT2_REFRESH_TOKEN`.

---

## Parte A — Crear el 2º canal (Brand Account)
1. Entra a **youtube.com** con **juandyb99@gmail.com**.
2. Clic en tu **foto de perfil** (arriba a la derecha) → **"Cambiar de cuenta"** → **"Crear un canal"** (o: Configuración ⚙️ → "Añadir o administrar tu(s) canal(es)" → "Crear un canal").
3. Ponle **nombre** al canal automático (puede ser genérico; luego lo refinamos). Acepta → **Crear**.
   - Esto crea un **canal de marca (Brand Account)** aparte, bajo tu misma cuenta de Google. No borra ni afecta a The Data Lens.
4. (Opcional) déjalo con lo mínimo; no necesita branding completo para la API.

## Parte B — Reusar el cliente OAuth (mismo proyecto)
No creas cliente nuevo. Usa el **mismo Client ID y Client Secret** del canal actual:
- Están en el JSON que descargaste (`client_secret_214831640948-...json`), o en **Google Cloud Console → APIs y servicios → Credenciales** (proyecto *The Data Lens*).
- **Al copiar el secret, copia SOLO el valor `GOCSPX-...`** (sin comillas ni lo que sigue) — ese detalle ya dio `invalid_client` antes.

## Parte C — Sacar el refresh token del 2º canal (OAuth Playground)
1. Ve a **developers.google.com/oauthplayground**.
2. ⚙️ (engranaje, arriba derecha) → marca **"Use your own OAuth credentials"** → pega **Client ID** y **Client Secret**.
3. En el campo de scopes de la izquierda pega estos tres (uno por línea):
```
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.force-ssl
https://www.googleapis.com/auth/yt-analytics.readonly
```
   *(El de `yt-analytics` es para que el canal auto tenga métricas/radar desde el día 1 y no toque re-autorizar después.)*
4. **"Authorize APIs"** → inicia sesión →
   **⚠️ CLAVE: en la pantalla de "elegir cuenta", selecciona el NUEVO canal de marca (el 2º canal), NO The Data Lens ni la cuenta personal.**
5. **"Exchange authorization code for tokens"** → copia el **Refresh token** que aparece.

## Parte D — Guardar los 3 secrets en GitHub
1. **github.com/juanberrio0399/video-forge** → **Settings** → **Secrets and variables → Actions** → **New repository secret**. Crea:
   - `YT2_CLIENT_ID` = el mismo Client ID.
   - `YT2_CLIENT_SECRET` = el mismo Client Secret (`GOCSPX-...`).
   - `YT2_REFRESH_TOKEN` = el refresh token NUEVO (el del 2º canal).

## Parte E — Confirmar
Avísame cuando estén los 3 secrets. Yo:
- Conecto el canal automático a `YT2_*` (namespacing en R2 `channel/auto2/…`).
- Disparo una verificación que confirme que el token lee el **2º canal correcto** (no The Data Lens).
- Con eso arranca la Fase 2 (ingesta + compilación + publicación automática).

---

**Notas:**
- Es el **mismo** proyecto/cliente OAuth del canal actual → no tocas nada de The Data Lens.
- El token no caduca (app en producción).
- Si en la Parte C eliges por error el canal equivocado, repite el paso 4-5 y elige el correcto.
