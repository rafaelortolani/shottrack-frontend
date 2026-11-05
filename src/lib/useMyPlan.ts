"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "@/lib/clientApi";
import type { MyPlan } from "@/lib/plans";

/**
 * Plano do atleta, limites efetivos e uso (FUC28, `GET /api/users/me/plan`, sempre no-store).
 * `refresh()` busca de novo — chamar depois de enviar ou excluir fotos, para o uso nunca ficar obsoleto.
 * Falha ao carregar não bloqueia nada: `plan` fica `null` e quem usa só deixa de mostrar o limite
 * (o backend continua sendo quem recusa o envio).
 */
export function useMyPlan(enabled = true) {
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    const result = await callApi<MyPlan>("/api/users/me/plan", { fallback: "Não foi possível carregar o seu plano" });
    if (mine !== seq.current) return; // chegou uma resposta mais nova
    if (result.ok) {
      setPlan(result.data);
      setError(null);
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // carga ao montar/habilitar; o setState acontece quando a resposta chega
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { plan, loading, error, refresh };
}
