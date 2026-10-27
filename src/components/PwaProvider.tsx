"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

/**
 * PWA (FUC22 / ADR-0020): registra o service worker (só em produção),
 * guarda o evento de instalação, acompanha online/offline e, sem conexão,
 * avisa e desabilita os envios de formulário. Nada de dados em cache.
 */
type InstallChoice = { outcome: "accepted" | "dismissed" };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type PwaState = {
  online: boolean;
  /** Já rodando como app instalado (tela cheia). */
  standalone: boolean;
  /** iPhone/iPad: não há prompt nativo, só as instruções do Compartilhar. */
  ios: boolean;
  /** O navegador ofereceu o prompt nativo de instalação (Android/Chrome). */
  canInstall: boolean;
  promptInstall: () => Promise<void>;
};

const PwaContext = createContext<PwaState | null>(null);

export function usePwa(): PwaState {
  const state = useContext(PwaContext);
  if (!state) throw new Error("usePwa precisa estar dentro de <PwaProvider>");
  return state;
}

const OFFLINE_MESSAGE = "Você está sem conexão. Para registrar, é preciso internet.";
const SUBMIT_SELECTOR = 'button[type="submit"], form button:not([type])';

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function subscribeStandalone(callback: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  // iPadOS 13+ se apresenta como Macintosh, mas tem toque
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** Registro só em produção; em dev, remove qualquer worker/cache antigo pra não servir código velho. */
function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // sem service worker o app funciona igual, só não tem a tela offline
      });
      return;
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((r) => r.unregister()));
    if ("caches" in window) {
      caches.keys().then((keys) => keys.filter((k) => k.startsWith("shottrack-")).forEach((k) => caches.delete(k)));
    }
  }, []);
}

/** Sem conexão: desabilita os botões de envio (e barra o submit, p.ex. por Enter). */
function useDisableSubmitsOffline(online: boolean) {
  useEffect(() => {
    if (online) return;

    const lock = () => {
      document.querySelectorAll<HTMLButtonElement>(SUBMIT_SELECTOR).forEach((button) => {
        if (!button.disabled) {
          button.disabled = true;
          button.dataset.offlineDisabled = "true";
        }
      });
    };
    const blockSubmit = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    lock();
    const observer = new MutationObserver(lock);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("submit", blockSubmit, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("submit", blockSubmit, true);
      document.querySelectorAll<HTMLButtonElement>("[data-offline-disabled]").forEach((button) => {
        button.disabled = false;
        delete button.dataset.offlineDisabled;
      });
    };
  }, [online]);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false);
  const ios = useSyncExternalStore(
    () => () => {},
    isIos,
    () => false
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useServiceWorker();
  useDisableSubmitsOffline(online);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); // guarda o evento pra disparar pelo nosso botão
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null); // o evento só vale uma vez
  }, [installEvent]);

  const value = useMemo<PwaState>(
    () => ({ online, standalone, ios, canInstall: installEvent !== null, promptInstall }),
    [online, standalone, ios, installEvent, promptInstall]
  );

  return (
    <PwaContext.Provider value={value}>
      {!online && (
        <p
          role="status"
          className="sticky top-0 z-50 bg-surface-raised border-b border-accent-brass px-4 py-2 text-center text-sm text-foreground"
        >
          {OFFLINE_MESSAGE}
        </p>
      )}
      {children}
    </PwaContext.Provider>
  );
}
