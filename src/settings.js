import React, { useRef, useState } from "react";
import { Alert } from "react-native";
import { Card, T, Action } from "./ui";
import { deviceRegistry, notificationTarget, parseLink } from "./push.js";

// The gateway contract is proposed. Keep physical registration off until the
// server can revoke bindings and revalidate memberships at delivery time.
export function usePushPreferences() {
  const [expanded, setExpanded] = useState(false),
    [enabled, setEnabled] = useState(false);
  const [severity, setSeverity] = useState(["P1", "P2"]),
    [selected, setSelected] = useState([]);
  const seen = useRef(new Set());
  const binding = useRef(null);
  return {
    expanded,
    setExpanded,
    enabled,
    setEnabled,
    severity,
    setSeverity,
    selected,
    setSelected,
    seen,
    binding,
  };
}
export function PushSettings({ org, isDemo, journeys, onDemo, preferences }) {
  const {
    expanded,
    setExpanded,
    enabled,
    setEnabled,
    severity,
    setSeverity,
    selected,
    setSelected,
    seen,
    binding,
  } = preferences;
  const registry = deviceRegistry(async (_path, body, method) => {
    binding.current = method === "PUT" ? body : null;
  });
  const prefs = { tenant: org.id, severities: severity, journeys: selected };
  const device = { platform: "demo", token: "synthetic" };
  async function change() {
    if (enabled) await registry.revoke(device);
    else await registry.register(device, prefs);
    setEnabled(!enabled);
  }
  function simulate() {
    const data = {
      event_id: "30000000-0000-4000-8000-000000000001",
      tenant: org.id,
      kind: "opened",
      incident_id: "10000000-0000-4000-8000-000000000001",
    };
    const p = binding.current?.preferences;
    if (
      org.id !== "varejo" ||
      !p?.severities.includes("P1") ||
      (p.journeys.length && !p.journeys.includes("pix"))
    )
      return Alert.alert("Evento fora das preferências");
    const id = parseLink(
      notificationTarget(data, org.id, seen.current),
      org.id,
    );
    if (id) onDemo(id);
    else Alert.alert("Evento já processado");
  }
  function options(values, selectedValues, update) {
    return values.map(([v, label]) => (
      <Action
        key={v}
        disabled={enabled}
        onPress={() =>
          update(
            selectedValues.includes(v)
              ? selectedValues.filter((x) => x !== v)
              : [...selectedValues, v],
          )
        }
      >
        {selectedValues.includes(v) ? "✓ " : ""}
        {label}
      </Action>
    ));
  }
  return (
    <Card>
      <Action onPress={() => setExpanded(!expanded)}>
        Preferências de notificação
      </Action>
      {expanded && (
        <>
          <T>{org.name}</T>
          <T kind="muted">
            {isDemo
              ? "Simulação local · desative para editar."
              : "Push aguarda habilitação corporativa."}
          </T>
          {isDemo && (
            <>
              <T kind="eyebrow">SEVERIDADES</T>
              {options(
                ["P1", "P2", "P3", "P4", "P5"].map((v) => [v, v]),
                severity,
                setSeverity,
              )}
              <T kind="eyebrow">JORNADAS · TODAS SE NENHUMA SELECIONADA</T>
              {options(
                journeys.map((j) => [j.id, j.name]),
                selected,
                setSelected,
              )}
              <Action onPress={change}>
                {enabled
                  ? "Revogar registro simulado"
                  : "Registrar dispositivo simulado"}
              </Action>
              {enabled && (
                <Action onPress={simulate}>
                  Testar abertura por notificação
                </Action>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
