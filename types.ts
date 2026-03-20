
export enum AppStage {
  IDEATION = 'IDEATION',
  CONCEPT_EXPLORATION = 'CONCEPT_EXPLORATION',
  PROMPT_CONSTRUCTION = 'PROMPT_CONSTRUCTION',
  AI_REFINEMENT = 'AI_REFINEMENT',
  FINAL_PROMPT = 'FINAL_PROMPT',
}

export interface PromptData {
  role: string;
  context: string;
  task: string;
  keywords: string[];
  constraints: string; // e.g. negative constraints, specific requirements
  tone: string; // e.g. formal, creative, academic
  format: string; // e.g. essay, bullet points, JSON
  audience: string; // e.g. experts, beginners, general public
}

export type AiConcepts = Record<string, string[]>; // Discipline name -> array of concepts

export interface RefinementSuggestion {
  id: string;
  type: 'variation' | 'improvement';
  /** The complete prompt text to apply when the user accepts this suggestion. */
  promptText: string;
  /** For improvements: the explanation of what was changed and why. */
  explanation?: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface PromptTemplate {
  name: string;
  description: string;
  coreIdea: string;
  disciplines: string[];
  promptData: Partial<PromptData>;
}
