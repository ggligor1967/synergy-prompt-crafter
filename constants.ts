
import { PromptData, PromptTemplate } from './types';

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
  LINK_COPIED: 'Link copied!',
  SHARE_FAILED: 'Failed to copy share link.',
  SHARED_PROMPT_LOADED: 'Prompt loaded from shared link!',
  TEMPLATE_APPLIED: (name: string) => `Template "${name}" applied!`,
} as const;

export const API_CONFIG = {
  geminiBaseUrl: import.meta.env.VITE_API_BASE_URL as string || 'http://localhost:3001',
  ollamaUrl: import.meta.env.VITE_OLLAMA_URL as string || 'http://localhost:11434',
  ollamaModel: import.meta.env.VITE_OLLAMA_MODEL as string || 'llama3',
};

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    name: 'Academic Research Paper',
    description: 'Structured prompt for writing academic research on scientific topics.',
    coreIdea: 'The impact of climate change on ocean biodiversity',
    disciplines: ['Environmental Science', 'Biology'],
    promptData: {
      role: 'Academic researcher specializing in marine biology',
      tone: 'Academic',
      format: 'Essay',
      audience: 'Academic peers and researchers',
      context: 'A peer-reviewed research paper submission',
      constraints: 'Cite credible sources, use technical terminology, follow APA format',
    },
  },
  {
    name: 'Creative Short Story',
    description: 'Generate a creative fiction prompt for a compelling short story.',
    coreIdea: 'A world where memories can be transferred between people',
    disciplines: ['Literature', 'Psychology'],
    promptData: {
      role: 'Creative fiction writer',
      tone: 'Creative',
      format: 'Short story',
      audience: 'General readers',
      context: 'A speculative fiction anthology submission',
      constraints: 'Under 2000 words, include a plot twist, develop character depth',
    },
  },
  {
    name: 'Code Review & Optimization',
    description: 'Technical prompt for reviewing and optimizing code quality.',
    coreIdea: 'Best practices for React performance optimization',
    disciplines: ['Computer Science', 'Engineering (General)'],
    promptData: {
      role: 'Senior software engineer and code reviewer',
      tone: 'Technical',
      format: 'Bullet points',
      audience: 'Mid-level software developers',
      context: 'A code review session for a production application',
      constraints: 'Focus on performance, readability, and maintainability',
    },
  },
  {
    name: 'Business Strategy Analysis',
    description: 'Comprehensive business analysis prompt for strategic decision-making.',
    coreIdea: 'Market entry strategy for a SaaS product in emerging markets',
    disciplines: ['Economics', 'Political Science'],
    promptData: {
      role: 'Business strategy consultant',
      tone: 'Formal',
      format: 'Detailed text',
      audience: 'C-suite executives and stakeholders',
      context: 'A board presentation for a new market expansion initiative',
      constraints: 'Include risk assessment, competitive analysis, and ROI projections',
    },
  },
  {
    name: 'Educational Lesson Plan',
    description: 'Create an engaging lesson plan for teaching complex concepts.',
    coreIdea: 'Teaching quantum mechanics to high school students',
    disciplines: ['Physics', 'Mathematics'],
    promptData: {
      role: 'Experienced physics educator',
      tone: 'Informal',
      format: 'Step-by-step guide',
      audience: 'High school students aged 16-18',
      context: 'An introductory physics class lesson',
      constraints: 'Use analogies and real-world examples, avoid heavy math notation, include activities',
    },
  },
  {
    name: 'Philosophical Debate',
    description: 'Explore philosophical questions through structured argumentation.',
    coreIdea: 'The ethics of artificial intelligence decision-making in healthcare',
    disciplines: ['Philosophy', 'Artificial Intelligence'],
    promptData: {
      role: 'Philosophy professor and AI ethics researcher',
      tone: 'Academic',
      format: 'Essay',
      audience: 'Graduate students in philosophy and computer science',
      context: 'A symposium on AI ethics',
      constraints: 'Present multiple perspectives, cite relevant philosophical frameworks, remain balanced',
    },
  },
];
