import { describe, it, expect } from 'vitest';
import { AppStage } from '../types';
import { getNextStage, getPrevStage } from '../navigation';

describe('Stage navigation', () => {
  it('advances from IDEATION to CONCEPT_EXPLORATION', () => {
    expect(getNextStage(AppStage.IDEATION)).toBe(AppStage.CONCEPT_EXPLORATION);
  });

  it('advances from CONCEPT_EXPLORATION to PROMPT_CONSTRUCTION', () => {
    expect(getNextStage(AppStage.CONCEPT_EXPLORATION)).toBe(AppStage.PROMPT_CONSTRUCTION);
  });

  it('does not advance past FINAL_PROMPT', () => {
    expect(getNextStage(AppStage.FINAL_PROMPT)).toBe(AppStage.FINAL_PROMPT);
  });

  it('goes back from CONCEPT_EXPLORATION to IDEATION', () => {
    expect(getPrevStage(AppStage.CONCEPT_EXPLORATION)).toBe(AppStage.IDEATION);
  });

  it('goes back from FINAL_PROMPT to AI_REFINEMENT', () => {
    expect(getPrevStage(AppStage.FINAL_PROMPT)).toBe(AppStage.AI_REFINEMENT);
  });

  it('does not go back before IDEATION', () => {
    expect(getPrevStage(AppStage.IDEATION)).toBe(AppStage.IDEATION);
  });
});
