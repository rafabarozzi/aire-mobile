import test from "node:test";
import assert from "node:assert/strict";
import { demo } from "../src/demo.js";
import {
  activeIncidents,
  forecast,
  nextUpdate,
  roomURL,
} from "../src/domain.js";
import { operations, jsonRequest } from "../src/operations.js";
import {
  notificationTarget,
  parseLink,
  deviceRegistry,
  eventKinds,
} from "../src/push.js";

const now = Date.parse("2026-11-04T12:00:00Z");
const api = demo("varejo", "normal", now);
const { incidents } = await api.overview();

test("impacto ordena incidentes simultâneos e exclui duplicados e encerrados", () => {
  const [pix, card, proposal] = incidents;
  const closed = { ...pix, state: "closed" },
    resolved = { ...pix, state: "resolved" },
    duplicate = { ...pix, duplicate_of: card.id };
  assert.deepEqual(
    activeIncidents([closed, proposal, duplicate, card, resolved, pix]),
    [pix, card, proposal],
  );
});
test("organização sem incidentes mantém saúde desconhecida", async () => {
  const other = await demo("relacional").overview();
  assert.equal(other.incidents.length, 0);
  assert.equal(other.journeys[0].health, "Sem leitura");
  await assert.rejects(
    demo("relacional").detail(incidents[0].id),
    (e) => e.status === 404,
  );
});
test("prazos distinguem previsão não confirmada, confirmada e vencida e comunicação atrasada", () => {
  assert.match(forecast(incidents[0].forecast, now), /Não confirmada/);
  assert.match(forecast(incidents[1].forecast, now), /Vencida/);
  assert.match(forecast(incidents[2].forecast, now), /Confirmada/);
  assert.match(forecast(incidents[2].forecast, now + 30 * 60000), /Vencida/);
  assert.match(nextUpdate(incidents[0], now), /atrasada/);
  assert.match(nextUpdate(incidents[1], now), /Próxima/);
  assert.match(
    nextUpdate(
      {
        ...incidents[0],
        pause: { until: new Date(now + 60000).toISOString() },
      },
      now,
    ),
    /pausada/,
  );
});
test("Operations pagina lista, deduplica ids e não fabrica saúde", async () => {
  const calls = [];
  const adapter = operations(async (path) => {
    calls.push(path);
    return path.endsWith("offset=0")
      ? Array(100).fill(incidents[0])
      : [incidents[1]];
  }, "varejo");
  const s = await adapter.overview();
  assert.deepEqual(calls, [
    "/v1/incidents?limit=100&offset=0",
    "/v1/incidents?limit=100&offset=100",
  ]);
  assert.equal(s.incidents.length, 2);
  assert.ok(s.journeys.every((j) => j.health === "Sem leitura"));
  assert.equal(s.catalogAvailable, false);
});
test("resposta de outra organização falha fechada", async () => {
  await assert.rejects(
    operations(async () => incidents, "relacional").overview(),
    /organização/,
  );
});
test("linha do tempo avança por versão e rejeita evento de outro incidente", async () => {
  const i = incidents[0];
  const adapter = operations(async (p) => {
    if (!p.includes("timeline")) return i;
    if (p.endsWith("after_version=0"))
      return Array.from({ length: 100 }, (_, n) => ({
        incident_id: i.id,
        version: n + 1,
      }));
    assert.ok(p.endsWith("after_version=100"));
    return [];
  }, i.tenant);
  assert.equal((await adapter.detail(i.id)).events.length, 100);
  const bad = operations(
    async (p) =>
      p.includes("timeline") ? [{ incident_id: "other", version: 2 }] : i,
    i.tenant,
  );
  await assert.rejects(bad.detail(i.id), /inconsistente/);
});
test("somente links HTTPS autorizáveis dos provedores podem ser abertos", () => {
  assert.equal(
    roomURL("https://app.slack.com/client/demo", "slack"),
    "https://app.slack.com/client/demo",
  );
  for (const url of [
    "http://teams.microsoft.com/test",
    "https://teams.microsoft.com.evil.org",
    "https://evil@teams.microsoft.com",
    "javascript:alert(1)",
  ])
    assert.equal(roomURL(url, "teams"), null);
});
test("push valida evento, deduplica e só abre incidente da organização selecionada", () => {
  const i = incidents[0],
    seen = new Set();
  const event = {
    kind: "opened",
    tenant: i.tenant,
    incident_id: i.id,
    event_id: "33333333-3333-4333-8333-333333333333",
  };
  assert.equal(notificationTarget(event, "relacional", seen), null);
  assert.equal(
    notificationTarget({ ...event, kind: "other" }, i.tenant, seen),
    null,
  );
  const link = notificationTarget(event, i.tenant, seen);
  assert.equal(parseLink(link, i.tenant), i.id);
  assert.equal(parseLink(link, "relacional"), null);
  assert.equal(notificationTarget(event, i.tenant, seen), null);
  for (const kind of eventKinds)
    assert.ok(notificationTarget({ ...event, kind }, i.tenant, new Set()));
  assert.equal(parseLink(link + "?token=1", i.tenant), null);
});
test("registro e revogação não alteram a API de incidentes", async () => {
  const calls = [],
    registry = deviceRegistry((...args) => calls.push(args));
  const prefs = { tenant: "varejo", severities: ["P1"], journeys: ["pix"] },
    device = { platform: "demo", token: "synthetic" };
  await registry.register(device, prefs);
  await registry.revoke(device);
  assert.deepEqual(calls, [
    ["/mobile/v1/device", { device, preferences: prefs }, "PUT"],
    ["/mobile/v1/device/revoke", { device }, "POST"],
  ]);
});
test("bearer nunca é enviado a um endpoint HTTP", async () => {
  await assert.rejects(
    jsonRequest("http://local", "/v1/incidents", "token"),
    /HTTPS/,
  );
});
test("falha simulada e acesso a sala respeitam o cenário e o estado", async () => {
  await assert.rejects(demo("varejo", "error").overview());
  const i = incidents[0];
  assert.equal(await api.joinRoom(i.id, i.rooms[0]), "demo");
  assert.equal(
    await api.joinRoom(incidents[1].id, incidents[1].rooms[0]),
    null,
  );
});
