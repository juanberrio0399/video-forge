# Política de seguridad

## Reportar una vulnerabilidad

Si encuentras un problema de seguridad en este proyecto, **no abras un Issue público**.
Repórtalo de forma privada por **GitHub Security Advisories**:
Repo → pestaña **Security** → **Report a vulnerability**.

Se responde lo antes posible. Gracias por el reporte responsable.

## Alcance

Este repo contiene un bot de Telegram (Cloudflare Worker) y automatizaciones de
producción de video. Los secretos viven en **GitHub Secrets** y en **Wrangler secrets**,
nunca en el código. Si crees que un secreto quedó expuesto, avisa por el canal de arriba
para poder rotarlo.

## Prácticas activas

- Secret scanning + push protection (GitHub).
- CodeQL (análisis estático) en cada push/PR a `main`.
- Dependabot (alertas y updates de dependencias).
- Autorización del Worker por HMAC oficial de Telegram + puerta de dueño único.
- Auto-respondedor de comentarios con sanitización, aislamiento y filtro de salida
  contra inyección de prompt indirecta.
