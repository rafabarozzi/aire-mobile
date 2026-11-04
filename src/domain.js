export const stateNames = {
  investigation: "Em investigação",
  mitigation: "Em mitigação",
  monitoring: "Em observação",
  resolved: "Resolvido",
  closed: "Encerrado",
};
export const impactNames = {
  unavailable: "Indisponível",
  partially_unavailable: "Indisponibilidade parcial",
  degraded: "Degradada",
  assessing: "Em avaliação",
  recovered: "Recuperada",
};
const ranks = [
  "unavailable",
  "partially_unavailable",
  "degraded",
  "assessing",
  "recovered",
];
function impactRank(i) {
  return Math.min(
    3 + (i.journeys.length ? 1 : 0),
    ...i.journeys.map((j) =>
      ranks.includes(j.impact) ? ranks.indexOf(j.impact) : 3,
    ),
  );
}
export function activeIncidents(rows) {
  return rows
    .filter((i) => !["resolved", "closed"].includes(i.state) && !i.duplicate_of)
    .sort(
      (a, b) =>
        impactRank(a) - impactRank(b) ||
        a.severity.localeCompare(b.severity, "en", { numeric: true }) ||
        a.title.localeCompare(b.title),
    );
}
export const when = (value) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Não informada";
export function forecast(f, now) {
  if (!f.at || f.status === "unknown") return "Não confirmada";
  return (
    (f.status === "overdue" || Date.parse(f.at) <= now
      ? "Vencida · "
      : "Confirmada · ") + when(f.at)
  );
}
export function nextUpdate(i, now) {
  if (i.pause && Date.parse(i.pause.until) > now)
    return "Comunicação pausada até " + when(i.pause.until);
  if (!i.next_update) return "Próxima comunicação sem horário";
  return (
    (Date.parse(i.next_update) <= now
      ? "Comunicação atrasada · "
      : "Próxima comunicação · ") + when(i.next_update)
  );
}
export function roomURL(value, provider) {
  try {
    const u = new URL(value);
    const valid =
      provider === "teams"
        ? ["teams.microsoft.com", "teams.cloud.microsoft"].includes(u.hostname)
        : provider === "slack" &&
          (u.hostname === "app.slack.com" || u.hostname.endsWith(".slack.com"));
    return valid &&
      u.protocol === "https:" &&
      !u.port &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
