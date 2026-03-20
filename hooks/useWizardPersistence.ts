import { useEffect } from 'react';
import { AppStage, AiConcepts, PromptData, RefinementSuggestion } from '../types';

const STORAGE_KEY = 'wizardState';

export interface PersistedWizardState {
  currentStage: AppStage;
  coreIdea: string;
  selectedDisciplines: string[];
  aiConcepts: AiConcepts | null;
  promptData: PromptData;
  generatedPrompt: string;
  refinementSuggestions: RefinementSuggestion[];
}

/**
 * Reads the persisted wizard state from sessionStorage once.
 * Returns an empty object on parse failure or if nothing was saved.
 * Call this inside a useState lazy initializer so it only runs on first render.
 */
export const loadWizardState = (): Partial<PersistedWizardState> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedWizardState>) : {};
  } catch {
    return {};
  }
};

/** Removes the persisted wizard state — call this when the user resets the app. */
export const clearWizardState = (): void => {
  sessionStorage.removeItem(STORAGE_KEY);
};

/**
 * Saves the wizard state to sessionStorage whenever any of the tracked values
 * change. Uses individual primitive/reference dependencies so React's
 * equality check works correctly.
 */
export const useWizardPersistence = (state: PersistedWizardState): void => {
  const {
    currentStage,
    coreIdea,
    selectedDisciplines,
    aiConcepts,
    promptData,
    generatedPrompt,
    refinementSuggestions,
  } = state;

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStage,
          coreIdea,
          selectedDisciplines,
          aiConcepts,
          promptData,
          generatedPrompt,
          refinementSuggestions,
        })
      );
    } catch {
      // sessionStorage may be full or unavailable (e.g. private browsing quota exceeded)
    }
  }, [
    currentStage,
    coreIdea,
    selectedDisciplines,
    aiConcepts,
    promptData,
    generatedPrompt,
    refinementSuggestions,
  ]);
};
