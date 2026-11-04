// All reads are scoped by the tenant-bound bearer issued by the identity service.
export function operations(get, tenant) {
  function scoped(i) {
    if (!i || i.tenant !== tenant)
      throw new Error("Resposta fora da organização");
    return i;
  }
  return {
    async overview() {
      const unique = new Map();
      for (let offset = 0; ; offset += 100) {
        const page = await get("/v1/incidents?limit=100&offset=" + offset);
        for (const i of page) unique.set(i.id, scoped(i));
        if (page.length < 100) break;
      }
      const incidents = [...unique.values()];
      const ids = [
        ...new Set(incidents.flatMap((i) => i.journeys.map((j) => j.id))),
      ];
      return {
        incidents,
        journeys: ids.map((id) => ({ id, name: id, health: "Sem leitura" })),
        catalogAvailable: false,
      };
    },
    async detail(id) {
      const path = "/v1/incidents/" + encodeURIComponent(id);
      const incident = scoped(await get(path));
      if (incident.id !== id) throw new Error("Incidente divergente");
      let cursor = 0;
      const events = [];
      for (;;) {
        const page = await get(
          path + "/timeline?limit=100&after_version=" + cursor,
        );
        for (const event of page) {
          if (event.incident_id !== id || event.version <= cursor)
            throw new Error("Linha do tempo inconsistente");
          events.push(event);
          cursor = event.version;
        }
        if (page.length < 100) break;
      }
      return { incident, events };
    },
    async joinRoom() {
      return null;
    },
  };
}
export async function jsonRequest(base, path, token, body, method) {
  if (!/^https:\/\//.test(base || ""))
    throw new Error("Endereço HTTPS obrigatório");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(base.replace(/\/$/, "") + path, {
      method: method || (body ? "POST" : "GET"),
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
    });
    if (!r.ok)
      throw Object.assign(new Error("Serviço indisponível"), {
        status: r.status,
      });
    return r.status === 204 ? null : await r.json();
  } finally {
    clearTimeout(timeout);
  }
}
