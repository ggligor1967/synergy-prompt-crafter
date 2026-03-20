/**
 * Wizard stage configuration and navigation helpers.
 * Single source of truth imported by both App.tsx and tests.
 */
import { AppStage } from './types';

export const STAGES_CONFIG = [
  { id: AppStage.IDEATION, name: 'Ideation' },
  { id: AppStage.CONCEPT_EXPLORATION, name: 'Concepts' },
  { id: AppStage.PROMPT_CONSTRUCTION, name: 'Construct' },
  { id: AppStage.AI_REFINEMENT, name: 'Refine' },
  { id: AppStage.FINAL_PROMPT, name: 'Finalize' },
];

export const getNextStage = (current: AppStage): AppStage => {
  const idx = STAGES_CONFIG.findIndex(s => s.id === current);
  return idx < STAGES_CONFIG.length - 1 ? STAGES_CONFIG[idx + 1].id : current;
};

export const getPrevStage = (current: AppStage): AppStage => {
  const idx = STAGES_CONFIG.findIndex(s => s.id === current);
  return idx > 0 ? STAGES_CONFIG[idx - 1].id : current;
};
