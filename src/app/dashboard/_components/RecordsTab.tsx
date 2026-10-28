"use client";

import Link from "next/link";
import {
  formatNumber,
  mostTrained,
  type Highlight,
  type ModalityOption,
  type TabContext,
} from "@/lib/dashboard";
import { resultTypeUnit } from "@/lib/resultTypeFormat";
import { EmptyNote } from "./shared";

/**
 * O backend devolve o recorde só com o NOME do tipo (sem ids). Pra abrir a
 * Evolução com a seleção certa: com filtro, a modalidade é a do filtro; sem
 * filtro, a mais treinada entre as que têm um tipo com esse nome.
 */
function evolutionTarget(
  record: Highlight,
  { options, modalities, filterId }: Pick<TabContext, "options" | "modalities" | "filterId">
): { modality: ModalityOption; resultTypeId: string } | null {
  const candidates = (filterId ? options.filter((m) => m.id === filterId) : options).filter((m) =>
    m.resultTypes.some((t) => t.name === record.resultTypeName)
  );
  if (candidates.length === 0) return null;

  const modality = mostTrained(candidates, modalities);
  return { modality, resultTypeId: modality.resultTypes.find((t) => t.name === record.resultTypeName)!.id };
}

/** Aba Recordes (FUC15 v6): lista completa (filtrada); tocar abre a Evolução. */
export function RecordsTab(context: TabContext) {
  const { dashboard, filterId, hrefFor } = context;

  return (
    <section aria-labelledby="records-title">
      <h2 id="records-title" className="font-display text-base font-semibold mb-2">
        Recordes
      </h2>

      {dashboard.records.length === 0 ? (
        <EmptyNote>
          Nenhum recorde ainda. Registre resultados nas suas séries e seus melhores valores aparecem aqui.
        </EmptyNote>
      ) : (
        <ul>
          {dashboard.records.map((record) => {
            const unit = resultTypeUnit(record.resultTypeName);
            const target = evolutionTarget(record, context);
            const href = target
              ? hrefFor({ aba: "evolucao", tipo: target.resultTypeId, mod: filterId ? null : target.modality.id })
              : hrefFor({ aba: "evolucao" });

            return (
              <li key={record.resultTypeName} className="border-b border-border last:border-0">
                <Link
                  href={href}
                  className="flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded-md hover:bg-surface transition-colors"
                >
                  <span className="text-foreground truncate">{record.resultTypeName}</span>
                  <span className="font-display text-2xl font-medium shrink-0">
                    {formatNumber(record.value)}
                    {unit && <span className="text-sm text-foreground-muted ml-1">{unit.suffix}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
