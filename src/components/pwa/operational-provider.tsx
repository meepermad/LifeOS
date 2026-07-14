"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type OpsContextValue = {
  online: boolean;
  updateReady: boolean;
  criticalMutation: boolean;
  unsavedForms: number;
  setCriticalMutation: (value: boolean) => void;
  markFormDirty: (formId: string, dirty: boolean) => void;
  applyUpdate: () => void;
  dismissUpdate: () => void;
};

const OpsContext = createContext<OpsContextValue | null>(null);

const DISMISSED_UPDATE_KEY = "lifeos:dismissed-sw-update";

export function OperationalProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [criticalMutation, setCriticalMutation] = useState(false);
  const [dirtyForms, setDirtyForms] = useState<Set<string>>(() => new Set());
  const [reconnectNotice, setReconnectNotice] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);

    function onOnline() {
      setOnline(true);
      setReconnectNotice(true);
      window.setTimeout(() => setReconnectNotice(false), 5000);
    }
    function onOffline() {
      setOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    function onUpdateFound() {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          const dismissed = sessionStorage.getItem(DISMISSED_UPDATE_KEY);
          const scriptUrl = registration?.waiting?.scriptURL ?? installing.scriptURL;
          if (dismissed === scriptUrl) return;
          setWaitingWorker(registration?.waiting ?? installing);
          setUpdateReady(true);
        }
      });
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) {
          const dismissed = sessionStorage.getItem(DISMISSED_UPDATE_KEY);
          if (dismissed !== reg.waiting.scriptURL) {
            setWaitingWorker(reg.waiting);
            setUpdateReady(true);
          }
        }
        reg.addEventListener("updatefound", onUpdateFound);
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });

    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  const markFormDirty = useCallback((formId: string, dirty: boolean) => {
    setDirtyForms((current) => {
      const next = new Set(current);
      if (dirty) next.add(formId);
      else next.delete(formId);
      return next;
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (criticalMutation || dirtyForms.size > 0) return;
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }, [criticalMutation, dirtyForms.size, waitingWorker]);

  const dismissUpdate = useCallback(() => {
    if (waitingWorker?.scriptURL) {
      sessionStorage.setItem(DISMISSED_UPDATE_KEY, waitingWorker.scriptURL);
    }
    setUpdateReady(false);
  }, [waitingWorker]);

  const value = useMemo(
    () => ({
      online,
      updateReady,
      criticalMutation,
      unsavedForms: dirtyForms.size,
      setCriticalMutation,
      markFormDirty,
      applyUpdate,
      dismissUpdate,
    }),
    [
      online,
      updateReady,
      criticalMutation,
      dirtyForms.size,
      markFormDirty,
      applyUpdate,
      dismissUpdate,
    ],
  );

  return (
    <OpsContext.Provider value={value}>
      {children}
      {!online ? (
        <div
          className="fixed inset-x-0 top-0 z-[90] border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-xs text-warning"
          role="status"
        >
          You are offline. Server-backed changes are unavailable. Already loaded
          data may be outdated.
        </div>
      ) : null}
      {online && reconnectNotice ? (
        <div
          className="fixed inset-x-0 top-0 z-[90] border-b border-success/40 bg-success/15 px-4 py-2 text-center text-xs text-success"
          role="status"
        >
          You’re back online. Review unsaved changes.
        </div>
      ) : null}
      {updateReady ? (
        <div
          className="fixed inset-x-0 bottom-20 z-[90] mx-auto max-w-lg rounded-xl border border-border bg-surface p-4 shadow-xl lg:bottom-6"
          role="status"
        >
          <p className="text-sm text-foreground">
            A new version of LifeOS is available.
          </p>
          {(criticalMutation || dirtyForms.size > 0) && (
            <p className="mt-1 text-xs text-muted">
              Finish unsaved work before reloading.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={criticalMutation || dirtyForms.size > 0}
              onClick={applyUpdate}
            >
              Reload now
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted"
              onClick={dismissUpdate}
            >
              Later
            </button>
          </div>
        </div>
      ) : null}
    </OpsContext.Provider>
  );
}

export function useOperationalState() {
  const context = useContext(OpsContext);
  if (!context) {
    throw new Error("useOperationalState must be used within OperationalProvider");
  }
  return context;
}
