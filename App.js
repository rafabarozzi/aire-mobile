import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StatusBar, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Theme, usePalette, T, Action, Card } from "./src/ui";
import { Center } from "./src/Center";
import { clearSession, demoMode, selectTenant, signIn } from "./src/auth";
import { demoOrgs } from "./src/demo.js";

export default function App() {
  const c = usePalette(),
    dark = useColorScheme() === "dark";
  const [orgs, setOrgs] = useState(null),
    [context, setContext] = useState(null),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  const scroll = useRef(null);
  const scrollTop = useCallback(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);
  const generation = useRef(0);
  const exit = useCallback(async () => {
    ++generation.current;
    setContext(null);
    setOrgs(null);
    setBusy(true);
    setMessage("");
    try {
      await clearSession();
    } catch {
      setMessage("Não foi possível limpar a sessão do dispositivo.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    exit();
  }, [exit]);
  const denied = useCallback(() => {
    exit();
  }, [exit]);
  useEffect(() => {
    if (!context?.session) return;
    const check = () => {
      if (Date.now() >= Date.parse(context.session.expires_at)) exit();
    };
    const t = setTimeout(
      check,
      Math.min(
        2147483647,
        Math.max(0, Date.parse(context.session.expires_at) - Date.now()),
      ),
    );
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [context, exit]);
  async function run(action) {
    if (busy) return;
    const id = ++generation.current;
    setBusy(true);
    setMessage("");
    try {
      const apply = await action();
      if (id === generation.current) apply();
    } catch (e) {
      if (id === generation.current) {
        if ([401, 403].includes(e.status)) {
          await exit();
          setMessage("Sua sessão precisa ser renovada.");
        } else
          setMessage(
            "Não foi possível concluir. Confira a conexão e tente novamente.",
          );
      }
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  function login() {
    return run(async () => {
      const list = demoMode ? demoOrgs : await signIn();
      return () => setOrgs(list);
    });
  }
  function select(org) {
    return run(async () => {
      const session = demoMode ? null : await selectTenant(org.id);
      return () => setContext({ org, session });
    });
  }
  return (
    <SafeAreaProvider>
      <Theme.Provider value={c}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
          <ScrollView
            ref={scroll}
            key={context?.org.id || "identity"}
            contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 48 }}
          >
            {context ? (
              <Center
                key={context.org.id}
                {...context}
                isDemo={demoMode}
                leave={() => {
                  setContext(null);
                  setMessage("");
                }}
                onDenied={denied}
                scrollTop={scrollTop}
              />
            ) : (
              <>
                <T kind="eyebrow">NORTHEIA / AIRE</T>
                <T kind="title">
                  {orgs ? "Sua organização" : "Central de situação"}
                </T>
                <Card>
                  {orgs ? (
                    <>
                      <T>Escolha a organização que deseja acompanhar.</T>
                      {!orgs.length && <T>Nenhuma organização autorizada.</T>}
                      {orgs.map((o) => (
                        <Action
                          key={o.id}
                          disabled={busy}
                          onPress={() => select(o)}
                        >
                          {o.name}
                        </Action>
                      ))}
                    </>
                  ) : (
                    <>
                      <T>
                        Saúde das jornadas, impacto para clientes e próxima
                        comunicação em um só lugar.
                      </T>
                      <Action disabled={busy} onPress={login}>
                        {demoMode
                          ? "Entrar na demonstração"
                          : "Entrar com SSO corporativo"}
                      </Action>
                    </>
                  )}
                </Card>
              </>
            )}
            {busy && <T kind="muted">Aguarde…</T>}
            {!!message && <T alert>{message}</T>}
            {orgs && (
              <Action disabled={busy} onPress={exit}>
                Encerrar sessão
              </Action>
            )}
          </ScrollView>
        </SafeAreaView>
      </Theme.Provider>
    </SafeAreaProvider>
  );
}
