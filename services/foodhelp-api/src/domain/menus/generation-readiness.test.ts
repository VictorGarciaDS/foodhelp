import { describe, expect, it } from 'vitest';
import { getGenerationBlockReason, type GenerationReadiness } from './generation-readiness';

const completeInputs: GenerationReadiness = {
  verifiedFoods: true,
  prescriptionsReviewed: true,
  plannerApproved: true,
};

describe('menu generation gate', () => {
  it('blocks until each real input is reviewed', () => {
    expect(getGenerationBlockReason({ ...completeInputs, verifiedFoods: false })).toContain('catálogo');
    expect(getGenerationBlockReason({ ...completeInputs, prescriptionsReviewed: false })).toContain('prescripciones');
  });

  it('stays blocked when clinical inputs exist but there is no approved planner', () => {
    expect(getGenerationBlockReason({ ...completeInputs, plannerApproved: false })).toContain('planificador');
  });

  it('opens only when every gate has an explicit true value', () => {
    expect(getGenerationBlockReason(completeInputs)).toBeNull();
  });
});