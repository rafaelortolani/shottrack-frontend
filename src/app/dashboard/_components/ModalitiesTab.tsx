import { formatHighlight, type TabContext } from "@/lib/dashboard";
import { EmptyNote } from "./shared";

/** Aba Modalidades (FUC15 v6): todas as modalidades em que o atleta treinou — ignora o filtro global. */
export function ModalitiesTab({ modalities }: Pick<TabContext, "modalities">) {
  return (
    <section aria-labelledby="modalities-title">
      <h2 id="modalities-title" className="font-display text-base font-semibold mb-2">
        Modalidades
      </h2>

      {modalities.length === 0 ? (
        <EmptyNote>Nenhum treino registrado em nenhuma modalidade ainda.</EmptyNote>
      ) : (
        <ul>
          {modalities.map((m) => (
            <li
              key={m.modalityId}
              className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate">{m.modalityName}</p>
                <p className="text-sm text-foreground-muted">
                  {m.trainingCount} {m.trainingCount === 1 ? "treino" : "treinos"}
                </p>
              </div>
              {m.best && <span className="text-sm text-accent-target-soft shrink-0">Melhor {formatHighlight(m.best)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
