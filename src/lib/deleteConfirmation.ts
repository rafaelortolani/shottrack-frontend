/**
 * Textos das confirmações de exclusão com cascata (UC43/UC44) — mesmos
 * na tela de Visitas e no detalhe da visita.
 */
export function deleteTrainingMessage(modalityName: string): string {
  return `O treino de ${modalityName} e todas as séries dele serão excluídos. Essa ação não pode ser desfeita. Confirmar?`;
}

export function deleteVisitMessage(trainingCount: number): string {
  const cascade =
    trainingCount === 0
      ? "A visita será excluída."
      : `A visita, ${trainingCount === 1 ? "o treino" : `os ${trainingCount} treinos`} dela e todas as séries serão excluídos.`;
  return `${cascade} Essa ação não pode ser desfeita. Confirmar?`;
}
