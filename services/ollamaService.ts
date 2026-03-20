import { AIProvider, ProviderStatus } from './aiProvider';
import { AiConcepts, PromptData, RefinementSuggestion } from '../types';
import { parseJsonFromText } from './jsonParser';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3';

/** localStorage key used to persist the user-selected Ollama model across sessions. */
export const OLLAMA_MODEL_STORAGE_KEY = 'ollamaModel';

/**
 * Returns the Ollama base URL.
 * Resolution order: VITE_OLLAMA_URL env var → default (http://localhost:11434).
 */
const getOllamaUrl = (): string =>
  (import.meta.env.VITE_OLLAMA_URL as string) || DEFAULT_OLLAMA_URL;

/**
 * Returns the active Ollama model name.
 * Resolution order: localStorage → VITE_OLLAMA_MODEL env var → 'llama3'.
 */
const getModel = (): string =>
  localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY) ||
  (import.meta.env.VITE_OLLAMA_MODEL as string) ||
  DEFAULT_MODEL;

/**
 * Fetches the list of locally available Ollama model names via GET /api/tags.
 * Returns an empty array if Ollama is unreachable or returns a non-OK response.
 */
export const listModels = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${getOllamaUrl()}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data = await response.json() as { models: { name: string }[] };
    return (data.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
};

// P1.2 — Strips HTML/XML tags and backticks to prevent breaking prompt structure.
// User-controlled text is also wrapped in XML delimiters in each prompt template
// so the model can clearly distinguish system instructions from user content.
const sanitize = (s: string): string =>
  s.replace(/<[^>]*>/g, '').replace(/`/g, "'").trim();

// Re-export parseJsonFromText for backward compatibility with existing test imports
export { parseJsonFromText } from './jsonParser';
/**
 * Posts a prompt to the Ollama /api/generate endpoint and returns the model's
 * text response. Applies a 120-second hard timeout via AbortController.
 *
 * @param prompt  The plain-text prompt to send to the model.
 * @param options Additional Ollama request fields (e.g. `{ options: { temperature: 0.7 } }`).
 * @throws {Error} When the HTTP response is not OK, forwarding the model's error message.
 */
const makeOllamaRequest = async (prompt: string, options: Record<string, unknown> = {}): Promise<string> => {
  const url = `${getOllamaUrl()}/api/generate`;
  const model = getModel();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, ...options }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as { error?: string }).error || `Ollama API error: ${response.status}`);
    }

    const data = await response.json() as { response: string };
    return data.response;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * AIProvider implementation that routes all inference requests to a locally
 * running Ollama instance.
 *
 * Configuration (both optional, resolved at runtime):
 *  - VITE_OLLAMA_URL   — base URL of the Ollama server (default: http://localhost:11434)
 *  - VITE_OLLAMA_MODEL — model to use; can also be changed at runtime via the
 *                        Settings panel, which persists the choice in localStorage
 *                        under the {@link OLLAMA_MODEL_STORAGE_KEY} key.
 *
 * Start Ollama before using this provider: `ollama serve`
 */
export const OllamaProvider: AIProvider = {
  name: 'Ollama (Local)',
  id: 'ollama',

  /** Pings /api/tags with a 5-second timeout to determine if Ollama is reachable. */
  status: async (): Promise<ProviderStatus> => {
    try {
      const response = await fetch(`${getOllamaUrl()}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        return { configured: true };
      }
      return { configured: false, error: 'Ollama API returned an error' };
    } catch {
      return { configured: false, error: 'Ollama not running. Start it with: ollama serve' };
    }
  },

  generateConcepts: async (idea: string, disciplines: string[]): Promise<AiConcepts> => {
    const disciplineList = disciplines.map(d => sanitize(d)).join(', ');
    const prompt = `Based on the core idea below and focusing on the disciplines listed, generate key concepts, themes, or questions relevant for constructing a multidisciplinary prompt.
For each discipline, provide 2-4 distinct concepts or probing questions.
Return the output as a single JSON object where keys are the discipline names (exactly as provided) and values are arrays of concept strings. Do not include any explanatory text, markdown formatting, or anything outside the JSON object.

Disciplines: ${disciplineList}

<core_idea>
${sanitize(idea)}
</core_idea>

Example output for disciplines "History, Philosophy":
{
  "History": ["The long-term impact of event X", "Primary sources related to Y"],
  "Philosophy": ["Ethical implications of A", "Epistemological challenges in B"]
}`;

    const responseText = await makeOllamaRequest(prompt, { options: { temperature: 0.7 } });
    const concepts = parseJsonFromText<AiConcepts>(responseText);
    if (!concepts) throw new Error('Failed to parse concepts response from Ollama');
    return concepts;
  },

  generatePromptVariations: async (fullPrompt: string, numberOfVariations: number = 2): Promise<RefinementSuggestion[]> => {
    const prompt = `Generate ${numberOfVariations} distinct variations of the prompt below. Each variation should maintain the core multidisciplinary intent but explore slightly different angles, tones, or phrasing.
Return the output as a JSON array of strings, where each string is a complete prompt variation.
Example: ["Variation 1 text...", "Variation 2 text..."]
Ensure the output is ONLY the JSON array.

<prompt_to_vary>
${sanitize(fullPrompt)}
</prompt_to_vary>`;

    const responseText = await makeOllamaRequest(prompt, { options: { temperature: 0.8 } });
    const variations = parseJsonFromText<string[]>(responseText);
    return (variations || []).map((promptText, index) => ({
      id: `var-${Date.now()}-${index}`,
      promptText,
      type: 'variation' as const,
    }));
  },

  suggestImprovements: async (fullPrompt: string): Promise<RefinementSuggestion[]> => {
    const prompt = `Analyze the multidisciplinary prompt below for potential improvements.
Suggest 2-3 specific improvements. For each suggestion, briefly explain why it would improve the prompt and provide the improved text.
Return the output as a JSON array of objects, where each object has 'suggestion' (string) and 'improvedText' (string).
Example: [{"suggestion": "Clarify the target audience...", "improvedText": "Revised part of prompt..."}]
Ensure the output is ONLY the JSON array.

<prompt_to_improve>
${sanitize(fullPrompt)}
</prompt_to_improve>`;

    const responseText = await makeOllamaRequest(prompt, { options: { temperature: 0.6 } });
    const improvements = parseJsonFromText<{ suggestion: string; improvedText: string }[]>(responseText);
    return (improvements || []).map((item, index) => ({
      id: `imp-${Date.now()}-${index}`,
      promptText: item.improvedText,
      explanation: item.suggestion,
      type: 'improvement' as const,
    }));
  },

  generateFullPromptFromData: async (
    promptData: PromptData,
    selectedDisciplines: string[],
    coreIdea: string
  ): Promise<string> => {
    const promptStructure = `Core Idea: ${sanitize(coreIdea)}
Disciplines: ${selectedDisciplines.map(sanitize).join(', ')}
Role: ${sanitize(promptData.role) || 'An expert synthesizing knowledge from multiple fields.'}
Context: ${sanitize(promptData.context)}
Task: ${sanitize(promptData.task)}
Keywords: ${promptData.keywords.map(sanitize).join(', ') || 'N/A'}
Audience: ${sanitize(promptData.audience)}
Tone: ${sanitize(promptData.tone)}
Format: ${sanitize(promptData.format)}
Additional Constraints/Details: ${sanitize(promptData.constraints) || 'N/A'}`;

    const prompt = `Based on the structured information below, synthesize a complete, coherent, and effective multidisciplinary prompt. The prompt should be ready to be given to an advanced AI model. Ensure all provided components are well-integrated. Pay attention to the specified tone, format, and audience. Return only the final composed prompt as a single block of text — no meta-commentary or introductory phrases.

<structured_information>
${promptStructure}
</structured_information>`;

    return (await makeOllamaRequest(prompt, { options: { temperature: 0.7 } })).trim();
  },

  testGeneratedPrompt: async (promptText: string): Promise<string> => {
    return await makeOllamaRequest(sanitize(promptText));
  },
};
