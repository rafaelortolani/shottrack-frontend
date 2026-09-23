"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SeriesAccordion } from "@/components/SeriesAccordion";
import { PageContainer } from "@/components/PageContainer";
import { formatDateTime } from "@/lib/datetime";
import { deleteTrainingMessage, deleteVisitMessage } from "@/lib/deleteConfirmation";

type TrainingLocation = { id: string; name: string; city: string; state: string };
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

export default function DetalheVisitaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const visitId = params.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [location, setLocation] = useState<TrainingLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteTraining, setConfirmingDeleteTraining] = useState<Training | null>(null);
  const [deletingTraining, setDeletingTraining] = useState(false);
  const [confirmingDeleteVisit, setConfirmingDeleteVisit] = useState(false);
  const [deletingVisit, setDeletingVisit] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const [visitsRes, locationsRes] = await Promise.all([
        fetch("/api/visits"),
        fetch("/api/training-locations"),
      ]);

      if (visitsRes.status === 401 || locationsRes.status === 401) {
        router.push("/login");
        return;
      }

      if (!visitsRes.ok || !locationsRes.ok) {
        if (!cancelled) {
          setError("Não foi possível carregar a visita");
          setLoading(false);
        }
        return;
      }

      const { data: visits } = await visitsRes.json();
      const { data: locations } = await locationsRes.json();
      const foundVisit: Visit | undefined = visits.find((v: Visit) => v.id === visitId);

      if (!foundVisit) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setVisit(foundVisit);
        setLocation(locations.find((l: TrainingLocation) => l.id === foundVisit.trainingLocationId) ?? null);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [router, visitId]);

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

    setVisit((prev) => prev && { ...prev, trainings: prev.trainings.filter((t) => t.id !== trainingId) });
  }

  async function handleDeleteVisit() {
    setError(null);
    setDeletingVisit(true);

    const response = await fetch(`/api/visits/${visitId}`, { method: "DELETE" });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      setDeletingVisit(false);
      setConfirmingDeleteVisit(false);
      const { error } = await response.json();
      setError(error?.message ?? "Não foi possível excluir a visita");
      return;
    }

    router.push("/treinos/visitas");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-foreground-muted">Carregando visita...</p>
      </div>
    );
  }

  if (notFound || !visit) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground-muted mb-4">Visita não encontrada.</p>
          <Link href="/treinos/visitas" className="text-sm text-accent-target hover:text-accent-target-hover transition-colors">
            Voltar pros treinos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageContainer ringsClassName="text-accent-target-soft">
        <Breadcrumb
          items={[
            { href: "/treinos", label: "Treinos" },
            { href: "/treinos/visitas", label: "Visitas" },
            { label: "Visita" },
          ]}
        />

        <h1 className="font-display text-lg font-semibold tracking-tight mb-1">
          {location ? location.name : "Visita"}
        </h1>
        {location && (
          <p className="text-foreground-muted mb-4">{location.city} · {location.state}</p>
        )}

        {error && (
          <p className="text-sm text-accent-target mb-4" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 mb-4">
          <span
            className={
              visit.status === "IN_PROGRESS"
                ? "inline-flex items-center rounded-full bg-accent-brass/15 text-accent-brass-soft text-sm px-3 py-1"
                : "inline-flex items-center rounded-full bg-surface text-foreground-muted text-sm px-3 py-1"
            }
          >
            {visit.status === "IN_PROGRESS" ? "Em andamento" : "Encerrada"}
          </span>
          <span className="text-sm text-foreground-muted">
            Início: {formatDateTime(visit.startedAt)}
            {visit.endedAt && ` · Fim: ${formatDateTime(visit.endedAt)}`}
          </span>
        </div>

        <h2 className="text-sm text-foreground-muted mb-2">Treinos</h2>
        {visit.trainings.length === 0 ? (
          <p className="text-foreground-muted">Nenhum treino nessa visita.</p>
        ) : (
          <ul className="space-y-1">
            {visit.trainings.map((training) => (
              <li key={training.id} className="py-2 border-b border-border last:border-0">
                <div className="flex items-center justify-between">
                  <p className="text-foreground">{training.modalityName}</p>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        training.status === "IN_PROGRESS"
                          ? "text-sm text-accent-brass-soft"
                          : "text-sm text-foreground-muted"
                      }
                    >
                      {training.status === "IN_PROGRESS" ? "Em andamento" : "Encerrado"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteTraining(training)}
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
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 pt-3 border-t border-border">
          <button
            type="button"
            onClick={() => setConfirmingDeleteVisit(true)}
            className="text-sm text-foreground-muted hover:text-accent-target transition-colors"
          >
            Excluir visita
          </button>
        </div>
      </PageContainer>

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

      {confirmingDeleteVisit && (
        <ConfirmDialog
          id="confirm-delete-visit"
          title="Excluir visita"
          busy={deletingVisit}
          busyLabel="Excluindo..."
          onCancel={() => setConfirmingDeleteVisit(false)}
          onConfirm={handleDeleteVisit}
        >
          {deleteVisitMessage(visit.trainings.length)}
        </ConfirmDialog>
      )}
    </>
  );
}
