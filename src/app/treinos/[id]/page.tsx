"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { TargetRings } from "@/components/TargetRings";
import { formatDateTime } from "@/lib/datetime";

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
          <Link href="/treinos" className="text-sm text-accent-target hover:text-accent-target-hover transition-colors">
            Voltar pros treinos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <TargetRings className="absolute -top-14 -right-14 z-0 w-[380px] h-[380px] text-accent-target-soft pointer-events-none" />

      <div className="relative max-w-lg px-5 md:px-6 py-6 pb-20 md:pb-6">
        <Breadcrumb items={[{ href: "/treinos", label: "Treinos" }, { label: "Visita" }]} />

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
              <li
                key={training.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <p className="text-foreground">{training.modalityName}</p>
                <span
                  className={
                    training.status === "IN_PROGRESS"
                      ? "text-sm text-accent-brass-soft"
                      : "text-sm text-foreground-muted"
                  }
                >
                  {training.status === "IN_PROGRESS" ? "Em andamento" : "Encerrado"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
