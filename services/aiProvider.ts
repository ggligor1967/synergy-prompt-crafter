import { AiConcepts, PromptData, RefinementSuggestion } from '../types';

export interface ProviderStatus {
  configured: boolean;
  error?: string;
}

export interface AIProvider {
  name: string;
  id: string;
  status: () => Promise<ProviderStatus>;
  generateConcepts: (idea: string, disciplines: string[]) => Promise<AiConcepts>;
  generatePromptVariations: (fullPrompt: string, numberOfVariations?: number) => Promise<RefinementSuggestion[]>;
  suggestImprovements: (fullPrompt: string) => Promise<RefinementSuggestion[]>;
  generateFullPromptFromData: (promptData: PromptData, selectedDisciplines: string[], coreIdea: string) => Promise<string>;
  testGeneratedPrompt: (promptText: string) => Promise<string>;
}
