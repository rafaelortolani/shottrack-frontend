"use client";

import { useEffect } from "react";
import { createRenewingFetch } from "@/lib/renewingFetch";

/** Instala o `fetch` com renovação de sessão (A07) no navegador, para todas as telas. */
export function SessionRenewal() {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = createRenewingFetch(original.bind(window), window.location.origin);
    return () => {
      window.fetch = original;
    };
  }, []);
  return null;
}
