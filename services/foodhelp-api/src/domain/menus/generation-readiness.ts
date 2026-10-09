export type GenerationReadiness = {
  verifiedFoods: boolean;
  prescriptionsReviewed: boolean;
  plannerApproved: boolean;
};

export function getGenerationBlockReason(readiness: GenerationReadiness): string | null {
  if (!readiness.verifiedFoods) return 'Falta un catálogo alimentario verificado.';
  if (!readiness.prescriptionsReviewed) return 'Faltan prescripciones reales revisadas.';
  if (!readiness.plannerApproved) return 'No hay un planificador clínico aprobado.';
  return null;
}