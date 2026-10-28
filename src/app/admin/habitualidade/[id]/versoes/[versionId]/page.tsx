"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { callApi } from "@/lib/clientApi";
import type { AdminVersion } from "@/lib/habituality";
import { todayIso } from "../../../_components/dates";
import { VersionEditor } from "../../../_components/VersionEditor";

/** Versão futura: editor (editar/excluir). Vigente ou passada: somente leitura. */
export default function VersaoPage() {
  const router = useRouter();
  const { id, versionId } = useParams<{ id: string; versionId: string }>();
  const [version, setVersion] = useState<AdminVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    callApi<AdminVersion[]>(`/api/admin/habituality/rules/${id}/versions`, {
      fallback: "Não foi possível carregar a versão",
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        if (result.status === 401) router.push("/login");
        else setError(result.message);
        return;
      }
      const found = result.data.find((v) => v.id === versionId);
      if (found) setVersion(found);
      else setError("Versão não encontrada");
    });
    return () => {
      cancelled = true;
    };
  }, [id, versionId, router]);

  const future = version ? version.validFrom > todayIso() : false;

  return (
    <div>
      <Breadcrumb
        items={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/habitualidade", label: "Habitualidade" },
          { href: `/admin/habitualidade/${id}`, label: "Regra" },
          { label: "Versão" },
        ]}
      />
      <h1 className="font-display text-lg font-semibold mb-4">Versão</h1>
      {error ? (
        <p className="text-sm text-accent-target" role="alert">
          {error}
        </p>
      ) : !version ? (
        <p className="text-foreground-muted">Carregando versão...</p>
      ) : (
        <VersionEditor ruleId={id} version={version} readOnly={!future} />
      )}
    </div>
  );
}
