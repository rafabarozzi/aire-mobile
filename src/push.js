const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const tenantKey = /^[A-Za-z0-9_.-]{1,100}$/;
export function incidentLink(tenant, id) {
  if (!tenantKey.test(tenant) || !uuid.test(id)) return null;
  return "com.northeia.aire://incident/" + tenant + "/" + id;
}
export function parseLink(value, tenant) {
  const match = /^com\.northeia\.aire:\/\/incident\/([^/]+)\/([^/?#]+)$/.exec(
    value || "",
  );
  return match && match[1] === tenant && incidentLink(tenant, match[2])
    ? match[2]
    : null;
}
export const eventKinds = ["opened", "impact_changed", "updated", "normalized"];
export function notificationTarget(data, tenant, seen) {
  if (
    !data ||
    data.tenant !== tenant ||
    !uuid.test(data.event_id) ||
    !eventKinds.includes(data.kind) ||
    seen.has(data.event_id)
  )
    return null;
  const link = incidentLink(tenant, data.incident_id);
  if (!link) return null;
  seen.add(data.event_id);
  if (seen.size > 200) seen.delete(seen.values().next().value);
  return link;
}
export function deviceRegistry(request) {
  return {
    register: (device, prefs) =>
      request("/mobile/v1/device", { device, preferences: prefs }, "PUT"),
    revoke: (device) => request("/mobile/v1/device/revoke", { device }, "POST"),
  };
}
