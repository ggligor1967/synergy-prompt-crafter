
import { PromptData } from './types';

export const PREDEFINED_DISCIPLINES: string[] = [
  "Artificial Intelligence",
  "Philosophy",
  "Physics",
  "Biology",
  "History",
  "Literature",
  "Economics",
  "Psychology",
  "Sociology",
  "Art History",
  "Computer Science",
  "Mathematics",
  "Environmental Science",
  "Political Science",
  "Music Theory",
  "Architecture",
  "Linguistics",
  "Anthropology",
  "Neuroscience",
  "Engineering (General)",
];

export const INITIAL_PROMPT_DATA: PromptData = {
  role: "",
  context: "",
  task: "",
  keywords: [],
  constraints: "",
  tone: "Neutral",
  format: "Detailed text",
  audience: "General",
};

export const PROMPT_TONES: string[] = [
  "Neutral", "Formal", "Informal", "Creative", "Academic", "Technical", 
  "Persuasive", "Humorous", "Skeptical", "Optimistic", "Pessimistic"
];

export const PROMPT_FORMATS: string[] = [
  "Detailed text", "Essay", "Bullet points", "Numbered list", "JSON object", 
  "XML structure", "Python code snippet", "JavaScript code snippet", 
  "Short story", "Poem", "Dialogue", "Step-by-step guide"
];

export const API_KEY_ERROR_MESSAGE = "AI provider not configured. Start the proxy server (server/) for Gemini, or run 'ollama serve' for Ollama.";

export const VARIATION_ID_PREFIX = 'var';
export const IMPROVEMENT_ID_PREFIX = 'imp';

export const TOAST_MESSAGES = {
  COPIED_SUCCESS: 'Prompt copied to clipboard!',
  COPY_FAILED: 'Failed to copy prompt.',
  SAVED_SUCCESS: 'Prompt saved to history!',
  RESTORED_SUCCESS: 'Prompt restored!',
  SWITCHED_PROVIDER: (name: string) => `Switched to ${name}`,
} as const;

export const API_CONFIG = {
  geminiBaseUrl: import.meta.env.VITE_API_BASE_URL as string || 'http://localhost:3001',
  ollamaUrl: import.meta.env.VITE_OLLAMA_URL as string || 'http://localhost:11434',
  ollamaModel: import.meta.env.VITE_OLLAMA_MODEL as string || 'llama3',
};
