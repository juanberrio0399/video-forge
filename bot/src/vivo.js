// Conexion en vivo de la app: un Durable Object guarda los WebSocket abiertos (con hibernacion: dormidos no
// cuestan) y, cuando algo cambia en cualquier sistema, les avisa "cambio" para que la app se refresque sola.
// No manda datos por el socket: solo la señal. Los datos siempre salen de /api/hoy, con su autenticacion.
import { DurableObject } from "cloudflare:workers";

export class Vivo extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // El "ping" de la app lo contesta Cloudflare sin despertar el objeto: mantener la conexion no cuesta.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/socket") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("se espera websocket", { status: 426 });
      const [cliente, servidor] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(servidor);
      servidor.serializeAttachment({ desde: Date.now() });
      return new Response(null, { status: 101, webSocket: cliente });
    }
    if (url.pathname === "/avisar" && request.method === "POST") {
      const motivo = String((await request.text()) || "cambio").slice(0, 40);
      const msg = JSON.stringify({ t: "cambio", motivo, at: Date.now() });
      let n = 0;
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(msg); n++; } catch { /* cerrado: lo limpia el runtime */ }
      }
      return new Response(JSON.stringify({ avisados: n }), { headers: { "content-type": "application/json" } });
    }
    return new Response("no", { status: 404 });
  }

  async webSocketMessage(ws, mensaje) {
    if (mensaje === "ping") ws.send("pong");      // respaldo si la respuesta automatica no estuviera activa
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, "chao"); } catch { /* ya cerrado */ }
  }
}

// Avisa a la app abierta que algo cambio. Nunca rompe a quien la llama.
export async function notificar(env, motivo = "cambio") {
  if (!env.VIVO) return;
  try {
    const stub = env.VIVO.get(env.VIVO.idFromName("juan"));
    await stub.fetch("https://vivo/avisar", { method: "POST", body: String(motivo) });
  } catch (e) {
    console.error("[vivo]", e && e.message);
  }
}

// Abre el socket para la app, solo si el initData es del dueño (lo valida quien llama).
export function socketVivo(env, request) {
  const stub = env.VIVO.get(env.VIVO.idFromName("juan"));
  return stub.fetch(new Request("https://vivo/socket", { headers: request.headers }));
}
