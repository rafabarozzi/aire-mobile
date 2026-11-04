import { useCallback, useEffect, useState, useRef } from "react";
import { AppState } from "react-native";

export function useRead(load, offline, onDenied, cache, key) {
  const [data, setData] = useState(() => cache?.get(key)?.data || null),
    [at, setAt] = useState(() => cache?.get(key)?.at || null);
  const [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const generation = useRef(0);
  useEffect(() => {
    if (!load || offline) {
      setBusy(false);
      return;
    }
    const id = ++generation.current;
    setBusy(true);
    load()
      .then((result) => {
        if (id !== generation.current) return;
        const time = Date.now();
        cache?.set(key, { data: result, at: time });
        setData(result);
        setAt(time);
        setError(false);
      })
      .catch((e) => {
        if (id !== generation.current) return;
        if ([401, 403].includes(e.status)) {
          cache?.clear();
          setData(null);
          onDenied();
          return;
        }
        if (e.status === 404) {
          cache?.delete(key);
          setData(null);
          setAt(null);
        }
        setError(true);
      })
      .finally(() => {
        if (id === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
    };
  }, [load, offline, revision, onDenied, cache, key]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, 60000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);
  return { data, at, error, busy, refresh };
}
