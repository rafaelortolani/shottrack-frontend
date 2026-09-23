import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

type BackendVisit = { id: string; trainings: { id: string }[] };
type BackendRecentTraining = { trainingId: string };

/**
 * BFF do dashboard (UC42): repassa o cookie de sessão como Bearer pro
 * backend. Atleta sem dados recebe onboarding completo, zeros e listas
 * vazias — não é erro.
 *
 * "Últimos treinos" do backend não traz a visita de cada treino nem o
 * total de treinos, e a tela precisa dos dois (link pro detalhe da visita
 * e "Ver todos" só quando há mais do que os 5 listados) — completados
 * aqui a partir de GET /api/visits, que já traz os treinos de cada visita.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("shottrack_access")?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sessão expirada" } },
      { status: 401 }
    );
  }

  const [dashboard, visits] = await Promise.all([
    backendFetch("/api/dashboard", { accessToken }),
    backendFetch("/api/visits", { accessToken }),
  ]);

  for (const { status, body } of [dashboard, visits]) {
    if (status !== 200 || body.error) {
      return NextResponse.json(
        { error: body.error ?? { code: "DASHBOARD_FETCH_FAILED", message: "Não foi possível carregar o dashboard" } },
        { status }
      );
    }
  }

  const visitIdByTrainingId = new Map<string, string>();
  for (const visit of visits.body.data as BackendVisit[]) {
    for (const training of visit.trainings) {
      visitIdByTrainingId.set(training.id, visit.id);
    }
  }

  const recentTrainings = (dashboard.body.data.recentTrainings as BackendRecentTraining[]).map((training) => ({
    ...training,
    visitId: visitIdByTrainingId.get(training.trainingId) ?? null,
  }));

  return NextResponse.json({
    data: {
      ...dashboard.body.data,
      recentTrainings,
      totalTrainings: visitIdByTrainingId.size,
    },
  });
}
