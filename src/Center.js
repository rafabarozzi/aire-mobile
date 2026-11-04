import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, BackHandler, Linking } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as Notifications from "expo-notifications";
import { config } from "./config";
import { demo } from "./demo.js";
import { operations, jsonRequest } from "./operations.js";
import {
  activeIncidents,
  forecast,
  impactNames,
  nextUpdate,
  roomURL,
  stateNames,
  when,
} from "./domain.js";
import { notificationTarget, parseLink } from "./push.js";
import { useRead } from "./useRead";
import { Action, Card, T } from "./ui";
import { PushSettings, usePushPreferences } from "./settings";

function Sync({ r, now, offline }) {
  return (
    <Card>
      <T kind="eyebrow">SINCRONIZAÇÃO</T>
      <T>{r.at ? "Última leitura · " + when(r.at) : "Ainda sem leitura"}</T>
      {offline && (
        <T alert>Offline · exibindo apenas dados já recebidos nesta sessão.</T>
      )}
      {r.error && (
        <T alert>
          Falha ao consultar.{" "}
          {r.data ? "A leitura anterior foi preservada." : "Tente novamente."}
        </T>
      )}
      {r.at && (offline || r.error || now - r.at > 120000) && (
        <T alert>Dados desatualizados</T>
      )}
      {r.busy && <T kind="muted">Atualizando…</T>}
      <Action disabled={offline || r.busy} onPress={r.refresh}>
        Atualizar agora
      </Action>
    </Card>
  );
}
const eventNames = {
  create: "Incidente registrado",
  updates: "Atualização da equipe",
  state: "Mudança de estado",
  rooms: "Atualização da sala",
  severity: "Mudança de severidade",
  journeys: "Impacto na jornada",
  corrections: "Correção registrada",
  references: "Registro externo",
};
function Detail({
  api,
  id,
  offline,
  now,
  onDenied,
  back,
  favorite,
  toggle,
  cache,
}) {
  const load = useCallback(() => api.detail(id), [api, id]);
  const r = useRead(load, offline, onDenied, cache, id);
  const i = r.data?.incident;
  async function join(room) {
    try {
      const value = await api.joinRoom(id, room);
      if (value === "demo")
        return Alert.alert(
          "Sala de demonstração",
          "O acesso à sala foi autorizado no cenário sintético.",
        );
      const url = roomURL(value, room.provider);
      if (!url) throw new Error();
      await Linking.openURL(url);
    } catch {
      Alert.alert("Acesso à sala indisponível");
    }
  }
  return (
    <>
      <Action onPress={back}>‹ Voltar à central</Action>
      <T kind="eyebrow">INCIDENTE</T>
      {i && (
        <>
          <T kind="title">{i.title}</T>
          <Card>
            <T kind="eyebrow">
              {i.severity} · {stateNames[i.state]}
            </T>
            <T>{i.business_impact || "Impacto em avaliação"}</T>
            <T>Equipe · {i.team}</T>
            <T>Previsão · {forecast(i.forecast, now)}</T>
            <T alert>{nextUpdate(i, now)}</T>
            <T kind="muted">
              Origem ·{" "}
              {
                {
                  manual: "Manual",
                  datadog: "Datadog",
                  dynatrace: "Dynatrace",
                }[i.origin]
              }
            </T>
            {i.references.map((ref) => (
              <T key={ref.provider + ref.identifier}>
                {ref.provider === "servicenow"
                  ? "ServiceNow"
                  : "Jira Service Management"}{" "}
                · {ref.identifier}
              </T>
            ))}
            <Action onPress={toggle}>
              {favorite ? "Remover dos favoritos" : "Favoritar incidente"}
            </Action>
          </Card>
          <T kind="heading">Jornadas afetadas</T>
          {i.journeys.map((j) => (
            <T key={j.id}>
              {j.id} · {impactNames[j.impact]}
            </T>
          ))}
          <T kind="heading">War Room</T>
          {!i.rooms.length && <T kind="muted">Sem sala vinculada</T>}
          {i.rooms.map((room) => (
            <Card key={room.provider + room.room_id}>
              <T>
                {room.provider === "teams" ? "Microsoft Teams" : "Slack"} ·{" "}
                {
                  {
                    open: "Aberta",
                    requested: "Solicitada",
                    closed: "Encerrada",
                  }[room.state]
                }
              </T>
              {room.state === "open" &&
                (api.roomAccess ? (
                  <Action disabled={offline} onPress={() => join(room)}>
                    Acessar sala
                  </Action>
                ) : (
                  <T kind="muted">Link autorizado indisponível</T>
                ))}
            </Card>
          ))}
          <T kind="heading">Linha do tempo</T>
          {!r.data.events.length && <T>Sem eventos disponíveis.</T>}
          {[...r.data.events].reverse().map((e) => (
            <Card key={e.id}>
              <T kind="eyebrow">
                {when(e.fact_at)} · {e.author}
              </T>
              <T>
                {e.data?.situation ||
                  e.data?.reason ||
                  eventNames[e.kind] ||
                  "Atualização do incidente"}
              </T>
            </Card>
          ))}
        </>
      )}
      <Sync r={r} now={now} offline={offline} />
    </>
  );
}
export function Center({ org, session, isDemo, leave, onDenied, scrollTop }) {
  const [tab, setTab] = useState("Resumo"),
    [id, setId] = useState(null),
    [favorites, setFavorites] = useState([]);
  const [scenario, setScenario] = useState("normal"),
    [disconnected, setDisconnected] = useState(false),
    [now, setNow] = useState(Date.now());
  const [started] = useState(Date.now);
  const preferences = usePushPreferences();
  useEffect(scrollTop, [id, scrollTop]);
  const [detailCache] = useState(() => new Map());
  const offline = disconnected || scenario === "offline";
  const api = useMemo(() => {
    if (isDemo) return { ...demo(org.id, scenario, started), roomAccess: true };
    return operations(
      (path) => jsonRequest(config.operations, path, session.access_token),
      org.id,
    );
  }, [org.id, session, isDemo, scenario, started]);
  const overview = useRead(api.overview, offline, onDenied);
  useEffect(
    () =>
      NetInfo.addEventListener((s) =>
        setDisconnected(
          s.isConnected === false || s.isInternetReachable === false,
        ),
      ),
    [],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (id) {
        setId(null);
        return true;
      }
      if (tab !== "Resumo") {
        setTab("Resumo");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [id, tab]);
  const seen = useRef(new Set());
  useEffect(() => {
    let live = true;
    const open = (url) => {
      const target = parseLink(url, org.id);
      if (live && target) setId(target);
    };
    const push = (res) => {
      if (!live || !res) return;
      const link = notificationTarget(
        res.notification.request.content.data,
        org.id,
        seen.current,
      );
      if (link) {
        open(link);
        Notifications.clearLastNotificationResponse();
      }
    };
    const linkSub = Linking.addEventListener("url", (e) => open(e.url));
    const pushSub = Notifications.addNotificationResponseReceivedListener(push);
    Linking.getInitialURL()
      .then(open)
      .catch(() => {});
    push(Notifications.getLastNotificationResponse());
    return () => {
      live = false;
      linkSub.remove();
      pushSub.remove();
    };
  }, [org.id]);
  const toggle = (key) =>
    setFavorites((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  if (id)
    return (
      <Detail
        key={id}
        cache={detailCache}
        {...{ id, now, offline, api, onDenied }}
        back={() => setId(null)}
        favorite={favorites.includes("i:" + id)}
        toggle={() => toggle("i:" + id)}
      />
    );
  const snap = overview.data,
    incidents = activeIncidents(snap?.incidents || []);
  const visible =
    tab === "Favoritos"
      ? incidents.filter((i) => favorites.includes("i:" + i.id))
      : incidents;
  const journeys = (snap?.journeys || []).filter(
    (j) => tab !== "Favoritos" || favorites.includes("j:" + j.id),
  );
  return (
    <>
      <T kind="eyebrow">AIRE / {org.name.toUpperCase()}</T>
      <T kind="title">Central de situação</T>
      <T kind="muted">
        {isDemo
          ? "Demonstração · dados sintéticos"
          : "Acompanhamento executivo"}
      </T>
      <Action
        onPress={() => setTab(tab === "Favoritos" ? "Resumo" : "Favoritos")}
      >
        {tab === "Favoritos" ? "Ver resumo" : "Ver favoritos"} ·{" "}
        {favorites.length}
      </Action>
      <Sync r={overview} now={now} offline={offline} />
      {snap && (
        <>
          <T kind="heading">
            {tab === "Favoritos" ? "Incidentes favoritos" : "Incidentes ativos"}{" "}
            · {visible.length}
          </T>
          {visible.map((i) => (
            <Card key={i.id}>
              <T kind="eyebrow">
                {i.severity} / {stateNames[i.state]}
              </T>
              <T kind="heading">{i.title}</T>
              <T>{i.business_impact || "Impacto em avaliação"}</T>
              <T alert>{nextUpdate(i, now)}</T>
              <Action onPress={() => setId(i.id)}>Acompanhar · {i.team}</Action>
            </Card>
          ))}
          {!visible.length && (
            <T>
              Nenhum incidente {tab === "Favoritos" ? "favorito" : "ativo"}.
            </T>
          )}
          <T kind="heading">Saúde das jornadas</T>
          {!snap.catalogAvailable && (
            <T kind="muted">
              Catálogo de saúde indisponível. As jornadas abaixo foram citadas
              em incidentes.
            </T>
          )}
          {!journeys.length && <T>Nenhuma jornada para exibir.</T>}
          {journeys.map((j) => (
            <Card key={j.id}>
              <T kind="eyebrow">{j.health}</T>
              <T>{j.name}</T>
              <Action onPress={() => toggle("j:" + j.id)}>
                {favorites.includes("j:" + j.id)
                  ? "Remover dos favoritos"
                  : "Favoritar jornada"}
              </Action>
            </Card>
          ))}
        </>
      )}
      <PushSettings
        {...{ org, isDemo, preferences }}
        journeys={snap?.journeys || []}
        onDemo={setId}
      />
      {isDemo && (
        <Card>
          <T kind="eyebrow">CENÁRIOS DE TESTE</T>
          {[
            ["normal", "Operação normal"],
            ["offline", "Simular offline"],
            ["error", "Simular erro de leitura"],
          ].map(([v, label]) => (
            <Action key={v} onPress={() => setScenario(v)}>
              {scenario === v ? "✓ " : ""}
              {label}
            </Action>
          ))}
        </Card>
      )}
      <Action onPress={leave}>Trocar organização</Action>
    </>
  );
}
