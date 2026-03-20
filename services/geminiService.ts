
import { AIProvider, ProviderStatus } from './aiProvider';
import { AiConcepts, RefinementSuggestion, PromptData } from '../types';
import { parseJsonFromText } from './jsonParser';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3001';
const API_SECRET = (import.meta.env.VITE_API_SECRET as string) || '';

/** localStorage key used to persist the user-selected Gemini model. */
export const GEMINI_MODEL_STORAGE_KEY = 'geminiModel';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

/** Known Gemini models available for selection in the UI. */
export const GEMINI_MODELS = [
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
] as const;

/** Returns the active Gemini model. Resolution: localStorage → default. */
export const getGeminiModel = (): string =>
  localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) || DEFAULT_GEMINI_MODEL;

// P1.2 — Strips HTML/XML tags and backticks to prevent breaking prompt structure.
// User-controlled text is also wrapped in XML delimiters in each prompt template
// so the model can clearly distinguish system instructions from user content.
const sanitize = (s: string): string =>
  s.replace(/<[^>]*>/g, '').replace(/`/g, "'").trim();

const makeGeminiRequest = async (body: Record<string, unknown>): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_SECRET) headers['x-api-key'] = API_SECRET;
  try {
    const response = await fetch(`${API_BASE_URL}/api/gemini/generate-content`, {
      method: 'POST',
      headers,
      // P4.2 — Send the user-selected model to the proxy so the server can use it.
      body: JSON.stringify({ ...body, model: getGeminiModel() }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error || `Gemini proxy error: ${response.status}`);
    }
    const data = await response.json() as { text: string };
    return data.text;
  } finally {
    clearTimeout(timeoutId);
  }
};


export const GeminiProvider: AIProvider = {
  name: 'Gemini (Cloud)',
  id: 'gemini',

  status: async (): Promise<ProviderStatus> => {
    try {
      const healthHeaders: Record<string, string> = {};
      if (API_SECRET) healthHeaders['x-api-key'] = API_SECRET;
      const response = await fetch(`${API_BASE_URL}/api/health`, { headers: healthHeaders, signal: AbortSignal.timeout(5000) });
      if (response.ok) return { configured: true };
      return { configured: false, error: 'Gemini proxy server returned an error' };
    } catch {
      return { configured: false, error: 'Cannot reach Gemini proxy server. Is it running? (npm start in server/)' };
    }
  },

  generateConcepts: async (idea: string, disciplines: string[]): Promise<AiConcepts> => {
    const disciplineList = disciplines.map(d => sanitize(d)).join(', ');
    const prompt = `Based on the core idea below and focusing on the disciplines listed, generate key concepts, themes, or questions relevant for constructing a multidisciplinary prompt.
For each discipline, provide 2-4 distinct concepts or probing questions.
Return the output as a single JSON object where keys are the discipline names (exactly as provided) and values are arrays of concept strings. Do not include any explanatory text, markdown formatting, or anything else outside the JSON object.

Disciplines: ${disciplineList}

<core_idea>
${sanitize(idea)}
</core_idea>

Example output for disciplines "History, Philosophy":
{
  "History": ["The long-term impact of event X", "Primary sources related to Y"],
  "Philosophy": ["Ethical implications of A", "Epistemological challenges in B"]
}`;

    const responseText = await makeGeminiRequest({
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.7 },
    });
    return parseJsonFromText<AiConcepts>(responseText) || {};
  },

  generatePromptVariations: async (fullPrompt: string, numberOfVariations: number = 2): Promise<RefinementSuggestion[]> => {
    const prompt = `Generate ${numberOfVariations} distinct variations of the prompt below. Each variation should maintain the core multidisciplinary intent but explore slightly different angles, tones, or phrasing.
Return the output as a JSON array of strings, where each string is a complete prompt variation.
Example: ["Variation 1 text...", "Variation 2 text..."]
Ensure the output is ONLY the JSON array.

<prompt_to_vary>
${sanitize(fullPrompt)}
</prompt_to_vary>`;

    const responseText = await makeGeminiRequest({
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.8 },
    });
    const variations = parseJsonFromText<string[]>(responseText);
    return (variations || []).map((promptText, index) => ({
      id: `var-${Date.now()}-${index}`,
      promptText,
      type: 'variation' as const,
    }));
  },

  suggestImprovements: async (fullPrompt: string): Promise<RefinementSuggestion[]> => {
    const prompt = `Analyze the multidisciplinary prompt below for potential improvements.
Suggest 2-3 specific improvements. For each suggestion, briefly explain why it would improve the prompt and provide the improved text snippet or rephrased section.
Return the output as a JSON array of objects, where each object has 'suggestion' (string) and 'improvedText' (string).
Example: [{"suggestion": "Clarify the target audience...", "improvedText": "Revised part of prompt..."}]
Ensure the output is ONLY the JSON array.

<prompt_to_improve>
${sanitize(fullPrompt)}
</prompt_to_improve>`;

    const responseText = await makeGeminiRequest({
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.6 },
    });
    const improvements = parseJsonFromText<{ suggestion: string; improvedText: string }[]>(responseText);
    return (improvements || []).map((item, index) => ({
      id: `imp-${Date.now()}-${index}`,
      promptText: item.improvedText,
      explanation: item.suggestion,
      type: 'improvement' as const,
    }));
  },

  generateFullPromptFromData: async (promptData: PromptData, selectedDisciplines: string[], coreIdea: string): Promise<string> => {
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

    const instruction = `Based on the structured information below, synthesize a complete, coherent, and effective multidisciplinary prompt. The prompt should be ready to be given to an advanced AI model. Ensure all provided components are well-integrated. Return only the final composed prompt as a single block of text — no meta-commentary.

<structured_information>
${promptStructure}
</structured_information>`;

    return (await makeGeminiRequest({ contents: instruction, config: { temperature: 0.7 } })).trim();
  },

  testGeneratedPrompt: async (promptText: string): Promise<string> => {
    return makeGeminiRequest({ contents: sanitize(promptText) });
  },
};
