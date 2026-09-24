"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconTarget } from "@tabler/icons-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddButton } from "@/components/AddButton";
import { EmptyState } from "@/components/EmptyState";
import { deleteTrainingMessage, deleteVisitMessage } from "@/lib/deleteConfirmation";
import { SeriesAccordion } from "@/components/SeriesAccordion";
import { formatDate, formatDateTime } from "@/lib/datetime";

type TrainingLocation = { id: string; name: string; city: string; state: string };
type Modality = { id: string; name: string };
type TrainingStatus = "IN_PROGRESS" | "CLOSED";
type Training = {
  id: string;
  modalityId: string;
  modalityName: string;
  status: TrainingStatus;
  startedAt: string;
  endedAt: string | null;
};
type Visit = {
  id: string;
  trainingLocationId: string;
  status: "IN_PROGRESS" | "CLOSED";
  startedAt: string;
  endedAt: string | null;
  trainings: Training[];
};

const INPUT_CLASS =
  "w-full rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors";

export default function VisitasTabPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [locations, setLocations] = useState<TrainingLocation[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [openingTraining, setOpeningTraining] = useState(false);
  const [selectedModalityId, setSelectedModalityId] = useState("");
  const [openTrainingFieldError, setOpenTrainingFieldError] = useState<string | null>(null);
  const [openingSaving, setOpeningSaving] = useState(false);
  const [closingTrainingId, setClosingTrainingId] = useState<string | null>(null);
  const [confirmingCloseVisit, setConfirmingCloseVisit] = useState(false);
  const [closingVisit, setClosingVisit] = useState(false);
  const [confirmingDeleteTraining, setConfirmingDeleteTraining] = useState<Training | null>(null);
  const [deletingTraining, setDeletingTraining] = useState(false);
  const [confirmingDeleteVisit, setConfirmingDeleteVisit] = useState(false);
  const [deletingVisit, setDeletingVisit] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyModalityFilter, setHistoryModalityFilter] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [visitsRes, locationsRes, modalitiesRes] = await Promise.all([
        fetch("/api/visits"),
        fetch("/api/training-locations"),
        fetch("/api/practiced-modalities"),
      ]);

      if (visitsRes.status === 401 || locationsRes.status === 401 || modalitiesRes.status === 401) {
        router.push("/login");
        return;
      }

      if (!visitsRes.ok || !locationsRes.ok || !modalitiesRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar as visitas");
          setLoading(false);
        }
        return;
      }

      const { data: visitsData } = await visitsRes.json();
      const { data: locationsData } = await locationsRes.json();
      const { data: modalitiesData } = await modalitiesRes.json();

      if (!cancelled) {
        setVisits(visitsData);
        setLocations(locationsData);
        setModalities(modalitiesData);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const activeVisit = visits.find((v) => v.status === "IN_PROGRESS") ?? null;
  const historyVisits = visits
    .filter((v) => v.status === "CLOSED")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const locationsById = new Map(locations.map((l) => [l.id, l]));

  function updateActiveVisit(updater: (v: Visit) => Visit) {
    if (!activeVisit) return;
    const targetId = activeVisit.id;
    setVisits((prev) => prev.map((v) => (v.id === targetId ? updater(v) : v)));
  }

  function handleToggleOpenTraining() {
    if (modalities.length === 0) {
      router.push("/usuario/modalidades");
      return;
    }
    setError(null);
    setOpenTrainingFieldError(null);
    setOpeningTraining(true);
  }

  function handleCancelOpenTraining() {
    setOpeningTraining(false);
    setSelectedModalityId("");
    setOpenTrainingFieldError(null);
  }

  async function handleSubmitOpenTraining(e: React.FormEvent) {
    e.preventDefault();
    if (!activeVisit) return;

    if (selectedModalityId === "") {
      setOpenTrainingFieldError("Selecione uma modalidade");
      return;
    }

    setOpenTrainingFieldError(null);
    setError(null);
    setOpeningSaving(true);

    const response = await fetch(`/api/visits/${activeVisit.id}/trainings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modalityId: selectedModalityId }),
    });

    setOpeningSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível abrir o treino");
      return;
    }

    const { data } = await response.json();
    updateActiveVisit((v) => ({ ...v, trainings: [...v.trainings, data] }));
    setOpeningTraining(false);
    setSelectedModalityId("");
  }

  async function handleCloseTraining(trainingId: string) {
    setError(null);
    setClosingTrainingId(trainingId);

    const response = await fetch(`/api/trainings/${trainingId}/close`, { method: "PATCH" });

    setClosingTrainingId(null);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível encerrar o treino");
      return;
    }

    const { data } = await response.json();
    updateActiveVisit((v) => ({
      ...v,
      trainings: v.trainings.map((t) => (t.id === data.id ? data : t)),
    }));
  }

  async function handleDeleteTraining() {
    if (!confirmingDeleteTraining) return;
    const trainingId = confirmingDeleteTraining.id;
    setError(null);
    setDeletingTraining(true);

    const response = await fetch(`/api/trainings/${trainingId}`, { method: "DELETE" });

    setDeletingTraining(false);
    setConfirmingDeleteTraining(null);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível excluir o treino");
      return;
    }

    updateActiveVisit((v) => ({ ...v, trainings: v.trainings.filter((t) => t.id !== trainingId) }));
  }

  async function handleDeleteVisit() {
    if (!activeVisit) return;
    const visitId = activeVisit.id;
    setError(null);
    setDeletingVisit(true);

    const response = await fetch(`/api/visits/${visitId}`, { method: "DELETE" });

    setDeletingVisit(false);
    setConfirmingDeleteVisit(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível excluir a visita");
      return;
    }

    setVisits((prev) => prev.filter((v) => v.id !== visitId));
  }

  function handleCloseVisitClick() {
    if (!activeVisit) return;
    const openCount = activeVisit.trainings.filter((t) => t.status === "IN_PROGRESS").length;
    if (openCount > 0) {
      setConfirmingCloseVisit(true);
      return;
    }
    closeVisit();
  }

  async function closeVisit() {
    if (!activeVisit) return;
    setError(null);
    setClosingVisit(true);

    const response = await fetch(`/api/visits/${activeVisit.id}/close`, { method: "PATCH" });

    setClosingVisit(false);
    setConfirmingCloseVisit(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível encerrar a visita");
      return;
    }

    const { data } = await response.json();
    setVisits((prev) => prev.map((v) => (v.id === data.id ? data : v)));
  }

  if (loading) {
    return <p className="text-foreground-muted">Carregando visitas...</p>;
  }

  return (
    <div>
      <Breadcrumb items={[{ href: "/treinos", label: "Treinos" }, { label: "Visitas" }]} />
      <h1 className="font-display text-lg font-semibold mb-4">Visitas</h1>

      {error && (
        <p className="text-sm text-accent-target mb-4" role="alert">
          {error}
        </p>
      )}

      {activeVisit ? (
        <ActiveVisitCard
          visit={activeVisit}
          location={locationsById.get(activeVisit.trainingLocationId) ?? null}
          modalities={modalities}
          openingTraining={openingTraining}
          selectedModalityId={selectedModalityId}
          openTrainingFieldError={openTrainingFieldError}
          openingSaving={openingSaving}
          onToggleOpenTraining={handleToggleOpenTraining}
          onSelectModality={setSelectedModalityId}
          onSubmitOpenTraining={handleSubmitOpenTraining}
          onCancelOpenTraining={handleCancelOpenTraining}
          closingTrainingId={closingTrainingId}
          onCloseTraining={handleCloseTraining}
          onDeleteTrainingClick={setConfirmingDeleteTraining}
          onCloseVisitClick={handleCloseVisitClick}
          closingVisit={closingVisit}
          onDeleteVisitClick={() => setConfirmingDeleteVisit(true)}
        />
      ) : locations.length === 0 ? (
        <div className="mb-6">
          <p className="text-foreground-muted mb-4">
            Nenhum local de treino cadastrado ainda. Cadastre um primeiro pra poder iniciar uma visita.
          </p>
          <Link
            href="/treinos/locais/novo"
            className="rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium px-4 py-2 transition-colors"
          >
            + Cadastrar local
          </Link>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-foreground-muted mb-4">Nenhuma visita em andamento.</p>
          <Link
            href="/treinos/nova"
            className="rounded-md bg-accent-target hover:bg-accent-target-hover text-background text-sm font-medium px-4 py-2 transition-colors"
          >
            Iniciar visita
          </Link>
        </div>
      )}

      <HistorySection
        visits={historyVisits}
        locationsById={locationsById}
        search={historySearch}
        onSearchChange={setHistorySearch}
        modalityFilter={historyModalityFilter}
        onModalityFilterChange={setHistoryModalityFilter}
        dateFrom={historyDateFrom}
        onDateFromChange={setHistoryDateFrom}
        dateTo={historyDateTo}
        onDateToChange={setHistoryDateTo}
      />

      {confirmingCloseVisit && activeVisit && (
        <ConfirmCloseVisitModal
          openCount={activeVisit.trainings.filter((t) => t.status === "IN_PROGRESS").length}
          onCancel={() => setConfirmingCloseVisit(false)}
          onConfirm={closeVisit}
          closing={closingVisit}
        />
      )}

      {confirmingDeleteTraining && (
        <ConfirmDialog
          id="confirm-delete-training"
          title="Excluir treino"
          busy={deletingTraining}
          busyLabel="Excluindo..."
          onCancel={() => setConfirmingDeleteTraining(null)}
          onConfirm={handleDeleteTraining}
        >
          {deleteTrainingMessage(confirmingDeleteTraining.modalityName)}
        </ConfirmDialog>
      )}

      {confirmingDeleteVisit && activeVisit && (
        <ConfirmDialog
          id="confirm-delete-visit"
          title="Excluir visita"
          busy={deletingVisit}
          busyLabel="Excluindo..."
          onCancel={() => setConfirmingDeleteVisit(false)}
          onConfirm={handleDeleteVisit}
        >
          {deleteVisitMessage(activeVisit.trainings.length)}
        </ConfirmDialog>
      )}
    </div>
  );
}

function ActiveVisitCard({
  visit,
  location,
  modalities,
  openingTraining,
  selectedModalityId,
  openTrainingFieldError,
  openingSaving,
  onToggleOpenTraining,
  onSelectModality,
  onSubmitOpenTraining,
  onCancelOpenTraining,
  closingTrainingId,
  onCloseTraining,
  onDeleteTrainingClick,
  onCloseVisitClick,
  closingVisit,
  onDeleteVisitClick,
}: {
  visit: Visit;
  location: TrainingLocation | null;
  modalities: Modality[];
  openingTraining: boolean;
  selectedModalityId: string;
  openTrainingFieldError: string | null;
  openingSaving: boolean;
  onToggleOpenTraining: () => void;
  onSelectModality: (id: string) => void;
  onSubmitOpenTraining: (e: React.FormEvent) => void;
  onCancelOpenTraining: () => void;
  closingTrainingId: string | null;
  onCloseTraining: (id: string) => void;
  onDeleteTrainingClick: (training: Training) => void;
  onCloseVisitClick: () => void;
  closingVisit: boolean;
  onDeleteVisitClick: () => void;
}) {
  return (
    <div className="rounded-md bg-surface p-4 mb-6">
      <p className="text-sm text-accent-brass-soft font-medium mb-1">Visita em andamento</p>
      <p className="text-foreground">{location ? location.name : "Local"}</p>
      {location && <p className="text-sm text-foreground-muted">{location.city} · {location.state}</p>}
      <p className="text-sm text-foreground-muted mb-3">Início: {formatDateTime(visit.startedAt)}</p>

      {visit.trainings.length > 0 && (
        <ul className="space-y-1 mb-3">
          {visit.trainings.map((training) => (
            <li key={training.id} className="py-2 border-b border-border last:border-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground">{training.modalityName}</p>
                  <p className="text-sm text-foreground-muted">
                    {training.status === "IN_PROGRESS"
                      ? "Em andamento"
                      : `Encerrado às ${formatDateTime(training.endedAt!)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {training.status === "IN_PROGRESS" && (
                    <button
                      type="button"
                      onClick={() => onCloseTraining(training.id)}
                      disabled={closingTrainingId === training.id}
                      className="text-sm text-accent-target hover:text-accent-target-hover disabled:opacity-60 transition-colors"
                    >
                      {closingTrainingId === training.id ? "Encerrando..." : "Encerrar"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteTrainingClick(training)}
                    className="text-sm text-foreground-muted hover:text-accent-target transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <SeriesAccordion
                trainingId={training.id}
                trainingOpen={training.status === "IN_PROGRESS"}
                modalityId={training.modalityId}
                defaultExpanded={training.status === "IN_PROGRESS"}
              />
            </li>
          ))}
        </ul>
      )}

      {openingTraining ? (
        <form onSubmit={onSubmitOpenTraining} className="space-y-2 mb-3">
          <div>
            <label htmlFor="modalityId" className="block text-xs uppercase tracking-wide text-foreground-muted mb-1">
              Modalidade
            </label>
            <select
              id="modalityId"
              value={selectedModalityId}
              onChange={(e) => onSelectModality(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="" disabled>Selecione</option>
              {modalities.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {openTrainingFieldError && (
              <p className="text-sm text-accent-target mt-1" role="alert">
                {openTrainingFieldError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={openingSaving}
              className="rounded-md bg-accent-target hover:bg-accent-target-hover disabled:opacity-60 text-background text-sm font-medium py-2 px-4 transition-colors"
            >
              {openingSaving ? "Abrindo..." : "Abrir"}
            </button>
            <button
              type="button"
              onClick={onCancelOpenTraining}
              className="text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : visit.trainings.length === 0 ? (
        <div className="mb-3">
          <EmptyState
            icon={IconTarget}
            title="Nenhum treino aberto ainda"
            description="Abra um treino pra cada modalidade que for praticar nesta visita — é nele que você registra as séries."
            actionLabel="Abrir treino"
            onAction={onToggleOpenTraining}
          />
        </div>
      ) : (
        <div className="mb-3">
          <AddButton onClick={onToggleOpenTraining}>Abrir novo treino</AddButton>
        </div>
      )}

      <div className="pt-3 border-t border-border flex items-center gap-3">
        <button
          type="button"
          onClick={onCloseVisitClick}
          disabled={closingVisit}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground hover:border-accent-target disabled:opacity-60 transition-colors"
        >
          {closingVisit ? "Encerrando..." : "Encerrar visita"}
        </button>
        <button
          type="button"
          onClick={onDeleteVisitClick}
          className="ml-auto text-sm text-foreground-muted hover:text-accent-target transition-colors"
        >
          Excluir visita
        </button>
      </div>
    </div>
  );
}

function ConfirmCloseVisitModal({
  openCount,
  onCancel,
  onConfirm,
  closing,
}: {
  openCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  closing: boolean;
}) {
  return (
    <ConfirmDialog
      id="confirm-close-visit"
      title="Encerrar visita"
      busy={closing}
      busyLabel="Encerrando..."
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      Você tem {openCount} treino{openCount === 1 ? "" : "s"} em andamento. Encerrar a visita vai encerrar{" "}
      {openCount === 1 ? "ele também" : "eles também"}. Confirmar?
    </ConfirmDialog>
  );
}

function isOnOrAfter(startedAt: string, dateFrom: string): boolean {
  if (!dateFrom) return true;
  return new Date(startedAt) >= new Date(`${dateFrom}T00:00:00`);
}

function isOnOrBefore(startedAt: string, dateTo: string): boolean {
  if (!dateTo) return true;
  return new Date(startedAt) <= new Date(`${dateTo}T23:59:59.999`);
}

function HistorySection({
  visits,
  locationsById,
  search,
  onSearchChange,
  modalityFilter,
  onModalityFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: {
  visits: Visit[];
  locationsById: Map<string, TrainingLocation>;
  search: string;
  onSearchChange: (value: string) => void;
  modalityFilter: string;
  onModalityFilterChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
}) {
  const query = search.trim().toLowerCase();
  const modalityNames = Array.from(new Set(visits.flatMap((v) => v.trainings.map((t) => t.modalityName)))).sort();
  const filtered = visits.filter((visit) => {
    const location = locationsById.get(visit.trainingLocationId);
    const matchesSearch = !query || Boolean(location && location.name.toLowerCase().includes(query));
    const matchesModality =
      !modalityFilter || visit.trainings.some((t) => t.modalityName === modalityFilter);
    const matchesDate = isOnOrAfter(visit.startedAt, dateFrom) && isOnOrBefore(visit.startedAt, dateTo);
    return matchesSearch && matchesModality && matchesDate;
  });

  return (
    <div>
      <h2 className="text-xs uppercase tracking-wide text-foreground-muted mb-2">Histórico</h2>
      {visits.length === 0 ? (
        <p className="text-foreground-muted">Nenhuma visita encerrada ainda.</p>
      ) : (
        <>
          {visits.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar por local"
                aria-label="Buscar visita por local"
                className="flex-1 min-w-[160px] rounded-md bg-surface border border-border px-3 py-2 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
              />
              <select
                value={modalityFilter}
                onChange={(e) => onModalityFilterChange(e.target.value)}
                aria-label="Filtrar por modalidade"
                className="rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
              >
                <option value="">Todas as modalidades</option>
                {modalityNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <label htmlFor="history-date-from" className="text-xs uppercase tracking-wide text-foreground-muted">
                  De
                </label>
                <input
                  id="history-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => onDateFromChange(e.target.value)}
                  className="rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="history-date-to" className="text-xs uppercase tracking-wide text-foreground-muted">
                  Até
                </label>
                <input
                  id="history-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => onDateToChange(e.target.value)}
                  className="rounded-md bg-surface border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent-target/50 focus:border-accent-target transition-colors"
                />
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-foreground-muted">Nenhuma visita encontrada com esses filtros.</p>
          ) : (
            <ul>
              {filtered.map((visit) => {
                const location = locationsById.get(visit.trainingLocationId);
                const modalityNames = Array.from(new Set(visit.trainings.map((t) => t.modalityName)));
                return (
                  <li key={visit.id} className="border-b border-border last:border-0">
                    <Link
                      href={`/treinos/${visit.id}`}
                      className="flex items-center justify-between py-2 -mx-2 px-2 rounded-md hover:bg-surface transition-colors"
                    >
                      <div>
                        <p className="text-foreground">{location ? location.name : "Local"}</p>
                        <p className="text-sm text-foreground-muted">
                          {formatDate(visit.startedAt)}
                          {modalityNames.length > 0 ? ` · ${modalityNames.join(", ")}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
