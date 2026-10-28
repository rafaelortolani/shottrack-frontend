"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/clientApi";
import { fromDateTimeLocal, oldestVisitStart, toDateTimeLocal, validateVisitDate } from "@/lib/visitDates";

type EditableVisit = { id: string; status: "IN_PROGRESS" | "CLOSED"; startedAt: string; endedAt: string | null };

const LABEL_CLASS = "block text-xs uppercase tracking-wide text-foreground-muted mb-1";
const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

/**
 * "Editar datas" da visita (FUC25 / UC59): início e, se encerrada, fim. Em
 * andamento só o início. `onSaved` recebe a visita já atualizada pelo backend.
 */
export function VisitDatesEditor<T extends EditableVisit>({ visit, onSaved }: { visit: T; onSaved: (visit: T) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const closed = visit.status === "CLOSED" && visit.endedAt !== null;
  const [now, setNow] = useState(() => new Date());

  function open() {
    setStartedAt(toDateTimeLocal(visit.startedAt));
    setEndedAt(visit.endedAt ? toDateTimeLocal(visit.endedAt) : "");
    setError(null);
    setNow(new Date());
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const invalid =
      validateVisitDate(startedAt, "o início", { checkAge: true }) ??
      (closed ? validateVisitDate(endedAt, "o fim", { checkAge: false }) : null);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (closed && new Date(endedAt) < new Date(startedAt)) {
      setError("O fim não pode ser anterior ao início");
      return;
    }

    setError(null);
    setSaving(true);
    const result = await callApi<T>(`/api/visits/${visit.id}/dates`, {
      method: "PATCH",
      body: {
        startedAt: fromDateTimeLocal(startedAt),
        ...(closed ? { endedAt: fromDateTimeLocal(endedAt) } : {}),
      },
      fallback: "Não foi possível salvar as datas da visita",
    });
    setSaving(false);

    if (!result.ok) {
      if (result.status === 401) {
        router.push("/login");
        return;
      }
      setError(result.message);
      return;
    }
    setEditing(false);
    onSaved(result.data);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        className="text-sm text-accent-target hover:text-accent-target-hover transition-colors"
      >
        Editar datas
      </button>
    );
  }

  return (
    <form onSubmit={save} noValidate aria-label="Editar datas da visita" className="rounded-md bg-surface p-4 space-y-3 mb-4">
      <div>
        <label htmlFor="visit-started-at" className={LABEL_CLASS}>
          Início
        </label>
        <input
          id="visit-started-at"
          type="datetime-local"
          value={startedAt}
          min={toDateTimeLocal(oldestVisitStart(now))}
          max={toDateTimeLocal(now)}
          onChange={(e) => setStartedAt(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      {closed && (
        <div>
          <label htmlFor="visit-ended-at" className={LABEL_CLASS}>
            Fim
          </label>
          <input
            id="visit-ended-at"
            type="datetime-local"
            value={endedAt}
            max={toDateTimeLocal(now)}
            onChange={(e) => setEndedAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      )}
      {error && (
        <p className="text-sm text-accent-target" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-background font-medium py-2 px-5 transition-colors"
        >
          {saving ? "Salvando..." : "Salvar datas"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
