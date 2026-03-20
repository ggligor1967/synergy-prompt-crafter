# Synergy Prompt Crafter — Sequential Implementation Plan

**Document:** Implementation Plan  
**Based on:** Comprehensive Codebase Analysis  
**Date:** 2026-03-20  
**Version:** 1.0

---

## Prerequisites

Before starting, ensure you have:
- Node.js v18+ installed
- npm v9+ installed
- Git installed
- Basic familiarity with terminal commands

---

## Phase 1: Critical Security Fixes

### Step 1.1: Create Server-Side API Proxy

**Files to Create:**
- `server/index.js` — Express server for API proxy
- `server/package.json` — Server dependencies

**Dependencies to Install:**
```bash
npm install express cors dotenv @google/genai
```

**Commands:**
```bash
cd c:/y/synergy-prompt-crafter
mkdir server
```

**File: `server/package.json`**
```json
{
  "name": "synergy-prompt-crafter-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0"
  }
}
```

**File: `server/.env`**
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3001
```

**File: `server/index.js`**
```javascript
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Proxy endpoint for all Gemini API calls
app.post('/api/gemini/generate-content', async (req, res) => {
  try {
    const { contents, config } = req.body;
    
    if (!contents) {
      return res.status(400).json({ error: 'contents is required' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents,
      config: config || {},
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Verification:**
```bash
cd c:/y/synergy-prompt-crafter/server
npm install
npm start
# In another terminal:
curl -X POST http://localhost:3001/api/gemini/generate-content \
  -H "Content-Type: application/json" \
  -d '{"contents": "Hello", "config": {}}'
# Should return JSON with AI response
```

---

### Step 1.2: Update geminiService.ts for Server Proxy

**File to Modify:** `services/geminiService.ts`

**Current Code (Lines 1-28):**
```typescript
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { AiConcepts, RefinementSuggestion, GroundingSource, PromptData } from '../types';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
let isConfigured = false;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
    isConfigured = true;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    isConfigured = false;
  }
} else {
  console.warn("API_KEY environment variable not found.");
  isConfigured = false;
}

export const getGeminiServiceStatus = (): { configured: boolean; error?: string } => {
  if (!isConfigured) {
    return { configured: false, error: API_KEY ? "Failed to initialize Gemini SDK." : "API_KEY environment variable not set." };
  }
  return { configured: true };
};
```

**Replace With:**
```typescript
import { AiConcepts, RefinementSuggestion, GroundingSource, PromptData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface ServiceStatus {
  configured: boolean;
  error?: string;
}

let isConfigured = false;

export const getGeminiServiceStatus = async (): Promise<ServiceStatus> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/gemini/generate-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: 'test', config: {} }),
    });
    
    if (response.ok) {
      isConfigured = true;
      return { configured: true };
    }
    
    const errorData = await response.json().catch(() => ({}));
    return { configured: false, error: errorData.error || 'Server returned error' };
  } catch (error) {
    isConfigured = false;
    return { configured: false, error: 'Cannot connect to API server. Ensure the server is running.' };
  }
};
```

**Current Code (Lines 51-87) — generateConcepts function:**
```typescript
export const generateConcepts = async (idea: string, disciplines: string[]): Promise<AiConcepts> => {
  if (!ai || !isConfigured) throw new Error("Gemini API not configured.");

  const disciplineList = disciplines.map(d => `"${d}"`).join(', ');
  const prompt = `
    Based on the core idea "${idea}" and focusing on the disciplines [${disciplineList}], 
    generate key concepts, themes, or questions relevant for constructing a multidisciplinary prompt.
    For each of the following disciplines: ${disciplineList}, provide 2-4 distinct concepts or probing questions.
    Return the output as a single JSON object where keys are the discipline names (exactly as provided: ${disciplineList}) 
    and values are arrays of concept strings. Do not include any explanatory text, markdown formatting, or anything else outside the JSON object.
    
    Example for disciplines ["History", "Philosophy"]:
    {
      "History": ["The long-term impact of event X", "Primary sources related to Y", "Historiographical debates surrounding Z"],
      "Philosophy": ["Ethical implications of A", "Epistemological challenges in B", "Metaphysical assumptions of C"]
    }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });
    const concepts = parseJsonFromText<AiConcepts>(response.text);
    return concepts || {};
  } catch (error) {
    console.error("Error generating concepts:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate concepts: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating concepts.");
  }
};
```

**Replace With:**
```typescript
const makeGeminiRequest = async (contents: string, config: Record<string, unknown> = {}) => {
  const response = await fetch(`${API_BASE_URL}/api/gemini/generate-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, config }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.text as string;
};

export const generateConcepts = async (idea: string, disciplines: string[]): Promise<AiConcepts> => {
  if (!idea || !disciplines.length) {
    throw new Error("Please provide a core idea and select at least one discipline.");
  }

  const sanitizedIdea = idea.replace(/[<>]/g, '').trim();
  const sanitizedDisciplines = disciplines.map(d => d.replace(/[<>]/g, '').trim());
  
  const disciplineList = sanitizedDisciplines.map(d => `"${d}"`).join(', ');
  const prompt = `
    Based on the core idea "${sanitizedIdea}" and focusing on the disciplines [${disciplineList}], 
    generate key concepts, themes, or questions relevant for constructing a multidisciplinary prompt.
    For each of the following disciplines: ${disciplineList}, provide 2-4 distinct concepts or probing questions.
    Return the output as a single JSON object where keys are the discipline names (exactly as provided: ${disciplineList}) 
    and values are arrays of concept strings. Do not include any explanatory text, markdown formatting, or anything else outside the JSON object.
    
    Example for disciplines ["History", "Philosophy"]:
    {
      "History": ["The long-term impact of event X", "Primary sources related to Y", "Historiographical debates surrounding Z"],
      "Philosophy": ["Ethical implications of A", "Epistemological challenges in B", "Metaphysical assumptions of C"]
    }
  `;

  try {
    const responseText = await makeGeminiRequest(prompt, {
      responseMimeType: "application/json",
      temperature: 0.7,
    });
    const concepts = parseJsonFromText<AiConcepts>(responseText);
    return concepts || {};
  } catch (error) {
    console.error("Error generating concepts:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate concepts: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating concepts.");
  }
};
```

**Continue replacing each API function with the new pattern. Due to length, here are the remaining functions to update:**

**Replace `refinePromptComponent` (Lines 89-112):**
```typescript
export const refinePromptComponent = async (componentType: string, currentText: string, context: string): Promise<string> => {
  const sanitizedType = componentType.replace(/[<>]/g, '').trim();
  const sanitizedText = currentText.replace(/[<>]/g, '').trim();
  const sanitizedContext = context.replace(/[<>]/g, '').trim();
  
  const prompt = `
    Refine the following '${sanitizedType}' for a multidisciplinary prompt. 
    Current text: "${sanitizedText}".
    Overall prompt context: "${sanitizedContext}".
    Make it more concise, impactful, and clear. Return only the refined text for the '${sanitizedType}'.
  `;
  try {
    const responseText = await makeGeminiRequest(prompt, { temperature: 0.5 });
    return responseText.trim();
  } catch (error) {
    console.error(`Error refining ${componentType}:`, error);
    if (error instanceof Error) {
        throw new Error(`Failed to refine ${componentType}: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while refining ${componentType}.`);
  }
};
```

**Replace `generatePromptVariations` (Lines 115-149):**
```typescript
export const generatePromptVariations = async (fullPrompt: string, numberOfVariations: number = 2): Promise<RefinementSuggestion[]> => {
  if (!fullPrompt) throw new Error("No prompt provided for variations.");
  
  const sanitizedPrompt = fullPrompt.replace(/[<>]/g, '').trim();
  const prompt = `
    Given the following prompt:
    "${sanitizedPrompt}"

    Generate ${numberOfVariations} distinct variations of this prompt. Each variation should maintain the core multidisciplinary intent but explore slightly different angles, tones, or phrasing.
    Return the output as a JSON array of strings, where each string is a complete prompt variation.
    Example: ["Variation 1 text...", "Variation 2 text..."]
    Ensure the output is ONLY the JSON array.
  `;
  try {
    const responseText = await makeGeminiRequest(prompt, { 
      responseMimeType: "application/json",
      temperature: 0.8 
    });
    const variations = parseJsonFromText<string[]>(responseText);
    return (variations || []).map((text, index) => ({
      id: `var-${Date.now()}-${index}`,
      text,
      type: 'variation'
    }));
  } catch (error) {
    console.error("Error generating prompt variations:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate prompt variations: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating prompt variations.");
  }
};
```

**Replace `suggestImprovements` (Lines 151-186):**
```typescript
export const suggestImprovements = async (fullPrompt: string): Promise<RefinementSuggestion[]> => {
  if (!fullPrompt) throw new Error("No prompt provided for improvements.");
  
  const sanitizedPrompt = fullPrompt.replace(/[<>]/g, '').trim();
  const prompt = `
    Analyze the following multidisciplinary prompt for potential improvements:
    "${sanitizedPrompt}"

    Suggest 2-3 specific improvements. For each suggestion, briefly explain why it would improve the prompt and provide the improved text snippet or rephrased section.
    Focus on areas like clarity, specificity, engagement, reducing ambiguity, or enhancing multidisciplinary connections.
    Return the output as a JSON array of objects, where each object has 'suggestion' (string, the explanation) and 'improvedText' (string, the modified prompt or part of it).
    Example: [{"suggestion": "Clarify the target audience...", "improvedText": "Revised part of prompt..."}]
    Ensure the output is ONLY the JSON array.
  `;
  try {
    const responseText = await makeGeminiRequest(prompt, { 
      responseMimeType: "application/json",
      temperature: 0.6
    });
    const improvements = parseJsonFromText<{ suggestion: string; improvedText: string }[]>(responseText);
    return (improvements || []).map((item, index) => ({
      id: `imp-${Date.now()}-${index}`,
      text: `${item.suggestion}\n\nRevised: ${item.improvedText}`,
      type: 'improvement'
    }));
  } catch (error) {
    console.error("Error suggesting improvements:", error);
     if (error instanceof Error) {
        throw new Error(`Failed to suggest improvements: ${error.message}`);
    }
    throw new Error("An unknown error occurred while suggesting improvements.");
  }
};
```

**Replace `generateFullPromptFromData` (Lines 188-233):**
```typescript
export const generateFullPromptFromData = async (
  promptData: PromptData,
  selectedDisciplines: string[],
  coreIdea: string
): Promise<string> => {
  if (!coreIdea && !promptData.task) throw new Error("Core idea or task is required.");

  const promptStructure = `
    Core Idea: ${coreIdea.replace(/[<>]/g, '').trim() || "N/A"}
    Disciplines: ${selectedDisciplines.map(d => d.replace(/[<>]/g, '').trim()).join(', ')}
    Role: ${(promptData.role || "An expert synthesizing knowledge from multiple fields.").replace(/[<>]/g, '').trim()}
    Context: ${(promptData.context || "").replace(/[<>]/g, '').trim()}
    Task: ${(promptData.task || "").replace(/[<>]/g, '').trim()}
    Keywords: ${(promptData.keywords || []).map(k => k.replace(/[<>]/g, '').trim()).join(', ') || "N/A"}
    Audience: ${(promptData.audience || "General").replace(/[<>]/g, '').trim()}
    Tone: ${(promptData.tone || "Neutral").replace(/[<>]/g, '').trim()}
    Format: ${(promptData.format || "Detailed text").replace(/[<>]/g, '').trim()}
    Additional Constraints/Details: ${(promptData.constraints || "N/A").replace(/[<>]/g, '').trim()}
  `;

  const instruction = `
    Based on the following structured information, synthesize a complete, coherent, and effective multidisciplinary prompt.
    The prompt should be ready to be given to an advanced AI model.
    Ensure all provided components are well-integrated.
    Pay attention to the specified tone, format, and audience.
    Return only the final composed prompt as a single block of text. Do not add any meta-commentary or introductory phrases like "Here is the prompt:".

    Structured Information:
    ${promptStructure}
  `;

  try {
    const responseText = await makeGeminiRequest(instruction, { temperature: 0.7 });
    return responseText.trim();
  } catch (error) {
    console.error("Error generating full prompt from data:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate full prompt: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating the full prompt.");
  }
};
```

**Replace `testGeneratedPrompt` (Lines 235-251):**
```typescript
export const testGeneratedPrompt = async (promptText: string): Promise<string> => {
  if (!promptText) throw new Error("No prompt text provided for testing.");
  
  const sanitizedPrompt = promptText.replace(/[<>]/g, '').trim();
  
  try {
    const responseText = await makeGeminiRequest(sanitizedPrompt, {});
    return responseText;
  } catch (error) {
    console.error("Error testing generated prompt:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to get AI response: ${error.message}`);
    }
    throw new Error("An unknown error occurred while testing the prompt.");
  }
};
```

**Also remove unused imports (Line 2):**
```typescript
// REMOVE this line completely:
// import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
```

**Verification:**
```bash
# Start the server in one terminal:
cd c:/y/synergy-prompt-crafter/server && npm start

# In another terminal, test the app:
cd c:/y/synergy-prompt-crafter && npm run dev
# Navigate through the app - AI features should work through the proxy
```

---

### Step 1.3: Update vite.config.ts to Remove API Key Exposure

**File to Modify:** `vite.config.ts`

**Current Code:**
```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
```

**Replace With:**
```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || 'http://localhost:3001')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
```

**Verification:**
```bash
cd c:/y/synergy-prompt-crafter
npm run build
# Check the built JS bundle for API key - it should NOT contain any Gemini API key
grep -r "GEMINI" dist/ || echo "No API key found in bundle - SUCCESS"
```

---

### Step 1.4: Update .env.local

**File to Modify:** `.env.local`

**Current Content:**
```
GEMINI_API_KEY=PLACEHOLDER_API_KEY
```

**Replace With:**
```
VITE_API_BASE_URL=http://localhost:3001
```

**Also update README.md instructions accordingly (see Phase 6).**

**Verification:**
```bash
cd c:/y/synergy-prompt-crafter
cat .env.local
# Should show: VITE_API_BASE_URL=http://localhost:3001
```

---

## Phase 2: Architecture Refactoring

### Step 2.1: Create Custom Hook for Async Operations

**File to Create:** `hooks/useAsyncOperation.ts`

```typescript
import { useState, useCallback } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

interface UseAsyncOperationResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  execute: (...args: Parameters<(...args: Parameters<() => Promise<T>) => Promise<void>>) => Promise<void>;
  reset: () => void;
}

export function useAsyncOperation<T>(
  asyncFn: (...args: unknown[]) => Promise<T>
): UseAsyncOperationResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(async (...args: unknown[]) => {
    setState({ data: null, error: null, isLoading: true });
    try {
      const result = await asyncFn(...args);
      setState({ data: result, error: null, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState({ data: null, error: errorMessage, isLoading: false });
      throw err;
    }
  }, [asyncFn]);

  const reset = useCallback(() => {
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}
```

**Verification:**
```bash
cat c:/y/synergy-prompt-crafter/hooks/useAsyncOperation.ts
# File should exist with content above
```

---

### Step 2.2: Create Toast Notification System

**File to Create:** `components/Toast.tsx`

```typescript
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextValue {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const Toast: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bgColors = {
    success: 'bg-green-700',
    error: 'bg-red-700',
    info: 'bg-sky-700',
    warning: 'bg-amber-700',
  };

  return (
    <div
      className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-md shadow-lg mb-2 animate-fade-in`}
      role="alert"
    >
      <p className="text-sm">{toast.message}</p>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
```

**Create CSS for animation:** Add to `index.html` or create `index.css`:
```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
```

**Verification:**
```bash
cat c:/y/synergy-prompt-crafter/components/Toast.tsx
# File should exist with content above
```

---

### Step 2.3: Extract Stage Components

**Files to Create:**

#### `components/stages/IdeationStage.tsx`
```typescript
import React from 'react';
import { ActionButton } from '../ActionButton';
import { Pill } from '../Pill';
import { LoadingSpinner } from '../LoadingSpinner';
import { SparklesIcon, PlusCircleIcon } from '../Icons';
import { PREDEFINED_DISCIPLINES } from '../../constants';

interface IdeationStageProps {
  coreIdea: string;
  onCoreIdeaChange: (value: string) => void;
  selectedDisciplines: string[];
  onAddDiscipline: (discipline: string) => void;
  onRemoveDiscipline: (discipline: string) => void;
  customDiscipline: string;
  onCustomDisciplineChange: (value: string) => void;
  onAddCustomDiscipline: () => void;
  onExploreConcepts: () => void;
  isLoading: boolean;
  isApiConfigured: boolean;
  apiKeyErrorMessage: string;
}

export const IdeationStage: React.FC<IdeationStageProps> = ({
  coreIdea,
  onCoreIdeaChange,
  selectedDisciplines,
  onAddDiscipline,
  onRemoveDiscipline,
  customDiscipline,
  onCustomDisciplineChange,
  onAddCustomDiscipline,
  onExploreConcepts,
  isLoading,
  isApiConfigured,
  apiKeyErrorMessage,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="coreIdea" className="block text-sm font-medium text-slate-300 mb-1">Core Idea or Question</label>
        <textarea
          id="coreIdea"
          value={coreIdea}
          onChange={(e) => onCoreIdeaChange(e.target.value)}
          placeholder="e.g., The impact of AI on Renaissance art interpretation"
          className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 custom-scrollbar"
          rows={4}
          aria-label="Core Idea or Question"
        />
      </div>
      <div>
        <label htmlFor="disciplineSelect" className="block text-sm font-medium text-slate-300 mb-1">Select Disciplines (Ctrl/Cmd + Click for multiple)</label>
        <select
          id="disciplineSelect"
          multiple
          value={selectedDisciplines}
          onChange={(e) => onAddDiscipline(e.target.value)}
          className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 h-48 custom-scrollbar"
          aria-label="Select Disciplines"
        >
          {PREDEFINED_DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="mt-2 space-y-1 flex flex-wrap gap-2">
          {selectedDisciplines.map(d => (
            <Pill key={d} text={d} onRemove={() => onRemoveDiscipline(d)} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-grow">
          <label htmlFor="customDiscipline" className="block text-sm font-medium text-slate-300 mb-1">Add Custom Discipline</label>
          <input
            type="text"
            id="customDiscipline"
            value={customDiscipline}
            onChange={(e) => onCustomDisciplineChange(e.target.value)}
            placeholder="e.g., Quantum Gastronomy"
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100"
            aria-label="Add Custom Discipline"
          />
        </div>
        <ActionButton onClick={onAddCustomDiscipline} disabled={!customDiscipline.trim()} icon={<PlusCircleIcon />} className="h-[46px]">Add</ActionButton>
      </div>
      <ActionButton 
        onClick={onExploreConcepts} 
        disabled={isLoading || !coreIdea.trim() || selectedDisciplines.length === 0 || !isApiConfigured} 
        icon={isLoading ? <LoadingSpinner size="w-4 h-4"/> : <SparklesIcon />}
        title={!isApiConfigured ? apiKeyErrorMessage : (!coreIdea.trim() || selectedDisciplines.length === 0 ? "Enter core idea and select disciplines" : "Explore concepts with AI")}
      >
        Explore Concepts
      </ActionButton>
      {!isApiConfigured && <p className="text-xs text-amber-400 mt-2">{apiKeyErrorMessage} AI-powered concept exploration is disabled.</p>}
    </div>
  );
};
```

#### `components/stages/ConceptExplorationStage.tsx`
```typescript
import React from 'react';
import { ActionButton } from '../ActionButton';
import { Pill } from '../Pill';
import { LoadingSpinner } from '../LoadingSpinner';
import { ArrowLeftIcon, ArrowRightIcon } from '../Icons';
import { AiConcepts, PromptData } from '../../types';

interface ConceptExplorationStageProps {
  isLoading: boolean;
  aiConcepts: AiConcepts | null;
  promptData: PromptData;
  onAddKeyword: (keyword: string) => void;
  onPrevStage: () => void;
  onNextStage: () => void;
  isApiConfigured: boolean;
  coreIdea: string;
  selectedDisciplines: string[];
  apiKeyErrorMessage: string;
}

export const ConceptExplorationStage: React.FC<ConceptExplorationStageProps> = ({
  isLoading,
  aiConcepts,
  promptData,
  onAddKeyword,
  onPrevStage,
  onNextStage,
  isApiConfigured,
  coreIdea,
  selectedDisciplines,
  apiKeyErrorMessage,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-sky-400">AI-Suggested Concepts</h3>
      {isLoading && <div className="flex justify-center"><LoadingSpinner /></div>}
      {aiConcepts && Object.keys(aiConcepts).length > 0 ? (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {Object.entries(aiConcepts).map(([discipline, concepts]) => (
            <div key={discipline} className="p-4 bg-slate-800 rounded-md">
              <h4 className="text-lg font-medium text-slate-300 mb-2">{discipline}</h4>
              <div className="flex flex-wrap gap-2">
                {concepts.map((concept, i) => {
                  const isKeyword = promptData.keywords.includes(concept);
                  return (
                    <Pill 
                      key={`${discipline}-${i}-${concept}`} 
                      text={concept} 
                      onClick={() => onAddKeyword(concept)}
                      color={isKeyword ? 'bg-sky-600' : 'bg-slate-700'}
                      textColor={isKeyword ? 'text-white' : 'text-slate-200'}
                      className={`transition-all duration-150 ${isKeyword ? 'ring-2 ring-sky-400 ring-offset-slate-800 ring-offset-1' : 'hover:bg-sky-700'} ${!isKeyword ? 'cursor-pointer' : 'cursor-default'}`}
                      title={isKeyword ? "Added as keyword (manage in 'Construct' stage)" : "Click to add to prompt keywords"}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : !isLoading && !isApiConfigured && (coreIdea.trim() && selectedDisciplines.length > 0) && 
        <p className="text-amber-400">AI concept generation is disabled due to API key configuration. You can proceed to construct your prompt manually.</p>}
      {!isLoading && (!aiConcepts || Object.keys(aiConcepts).length === 0) && 
        (isApiConfigured || (!coreIdea.trim() || selectedDisciplines.length === 0)) && 
        <p className="text-slate-400">No concepts generated. Ensure you've provided a core idea, selected disciplines, and that the API key is configured if you used "Explore Concepts". Otherwise, proceed to construct prompt manually.</p>}
      <div className="flex justify-between mt-6">
        <ActionButton onClick={onPrevStage} icon={<ArrowLeftIcon />} variant="secondary">Back to Ideation</ActionButton>
        <ActionButton onClick={onNextStage} icon={<ArrowRightIcon />}>Construct Prompt</ActionButton>
      </div>
    </div>
  );
};
```

**Note:** Due to length constraints, remaining stage components (PromptConstructionStage, RefinementStage, FinalPromptStage) should be extracted following the same pattern from the switch statement in App.tsx lines 349-494.

**Verification:**
```bash
ls -la c:/y/synergy-prompt-crafter/components/stages/
# Should list: IdeationStage.tsx, ConceptExplorationStage.tsx, etc.
```

---

### Step 2.4: Update App.tsx to Use Extracted Components

**File to Modify:** `App.tsx`

Due to the extensive changes required, here are the key modifications:

**1. Add new imports:**
```typescript
import { IdeationStage } from './components/stages/IdeationStage';
import { ConceptExplorationStage } from './components/stages/ConceptExplorationStage';
import { ToastProvider, useToast } from './components/Toast';
```

**2. Wrap App content with ToastProvider (around line 500):**
```typescript
<ToastProvider>
  <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-850 to-sky-900 text-slate-100" role="application">
    {/* existing content */}
  </div>
</ToastProvider>
```

**3. Replace native alert() with toast in copyToClipboard (around line 225):**
```typescript
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    // Replace alert with toast - need to use useToast hook
  } catch (err) {
    console.error("Failed to copy: ", err);
  }
};
```

**Note:** This step requires significant refactoring. The extracted components should handle their own state where possible.

**Verification:**
```bash
cd c:/y/synergy-prompt-crafter
npm run build
# Should compile without errors
```

---

### Step 2.5: Add AbortController for Request Cancellation

**File to Modify:** `services/geminiService.ts`

**Add to the file:**
```typescript
let abortController: AbortController | null = null;

export const cancelCurrentRequest = () => {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
};

// Modify makeGeminiRequest:
const makeGeminiRequest = async (contents: string, config: Record<string, unknown> = {}) => {
  abortController = new AbortController();
  
  const response = await fetch(`${API_BASE_URL}/api/gemini/generate-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, config }),
    signal: abortController.signal,
  });
  
  abortController = null;
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.text as string;
};
```

**Verification:**
```bash
cd c:/y/synergy-prompt-crafter
npm run build
# Should compile without errors
```

---

## Phase 3: Code Quality Improvements

### Step 3.1: Extract Magic Strings to Constants

**File to Modify:** `constants.ts`

**Add to existing file:**
```typescript
// ID Prefixes for suggestions
export const VARIATION_ID_PREFIX = 'var';
export const IMPROVEMENT_ID_PREFIX = 'imp';

// Toast messages
export const TOAST_MESSAGES = {
  COPIED_SUCCESS: 'Prompt copied to clipboard!',
  COPY_FAILED: 'Failed to copy prompt.',
  SERVER_CONNECTION_FAILED: 'Cannot connect to API server. Ensure the server is running.',
} as const;

// API Configuration
export const API_CONFIG = {
  TIMEOUT_MS: 30000,
  RETRY_ATTEMPTS: 3,
} as const;
```

**Verification:**
```bash
cat c:/y/synergy-prompt-crafter/constants.ts | grep -A5 "TOAST_MESSAGES"
# Should display toast message constants
```

---

### Step 3.2: Add Debouncing to AI Request Buttons

**File to Create:** `hooks/useDebounce.ts`
```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**Apply in App.tsx for test button:**
```typescript
// Add near top of App component
const debouncedPrompt = useDebounce(generatedPrompt, 500);

// Update handleTestPrompt to use debouncedPrompt
const handleTestPrompt = useCallback(async () => {
  if (!debouncedPrompt || !apiKeyStatus.configured) {
    setTestPromptError("Cannot test prompt. Ensure API key is configured and prompt exists.");
    return;
  }
  // rest of function
}, [debouncedPrompt, apiKeyStatus.configured]);
```

**Verification:**
```bash
cd c:/y/synergy-prompt-crafter
npm run build
# Should compile without errors
```

---

## Phase 4: Testing Setup

### Step 4.1: Install Testing Dependencies

**Dependencies to Install:**
```bash
cd c:/y/synergy-prompt-crafter
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom @types/react @types/react-dom
```

**Update `package.json`** — Add test script:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

**Create `vite.config.ts` test configuration:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**Create `src/test/setup.ts`:**
```typescript
import '@testing-library/jest-dom';
```

---

### Step 4.2: Create Unit Tests

**File to Create:** `src/test/geminiService.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { parseJsonFromText } from '../services/geminiService';

describe('parseJsonFromText', () => {
  it('should parse valid JSON object', () => {
    const input = '{"key": "value"}';
    const result = parseJsonFromText<{ key: string }>(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('should parse JSON wrapped in code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = parseJsonFromText<{ key: string }>(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('should return null for invalid JSON', () => {
    const input = 'not valid json at all';
    const result = parseJsonFromText(input);
    expect(result).toBeNull();
  });

  it('should handle empty string', () => {
    const result = parseJsonFromText('');
    expect(result).toBeNull();
  });
});
```

**File to Create:** `src/test/stageNavigation.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { AppStage } from '../types';

describe('Stage Navigation', () => {
  const STAGES_CONFIG = [
    { id: AppStage.IDEATION, name: 'Ideation' },
    { id: AppStage.CONCEPT_EXPLORATION, name: 'Concepts' },
    { id: AppStage.PROMPT_CONSTRUCTION, name: 'Construct' },
    { id: AppStage.AI_REFINEMENT, name: 'Refine' },
    { id: AppStage.FINAL_PROMPT, name: 'Finalize' },
  ];

  it('should move to next stage correctly', () => {
    const currentStage = AppStage.IDEATION;
    const currentIndex = STAGES_CONFIG.findIndex(s => s.id === currentStage);
    const nextStage = STAGES_CONFIG[currentIndex + 1];
    expect(nextStage.id).toBe(AppStage.CONCEPT_EXPLORATION);
  });

  it('should move to previous stage correctly', () => {
    const currentStage = AppStage.FINAL_PROMPT;
    const currentIndex = STAGES_CONFIG.findIndex(s => s.id === currentStage);
    const prevStage = STAGES_CONFIG[currentIndex - 1];
    expect(prevStage.id).toBe(AppStage.AI_REFINEMENT);
  });

  it('should not go beyond first stage', () => {
    const currentStage = AppStage.IDEATION;
    const currentIndex = STAGES_CONFIG.findIndex(s => s.id === currentStage);
    expect(currentIndex).toBe(0);
  });

  it('should not go beyond last stage', () => {
    const currentStage = AppStage.FINAL_PROMPT;
    const currentIndex = STAGES_CONFIG.findIndex(s => s.id === currentStage);
    expect(currentIndex).toBe(STAGES_CONFIG.length - 1);
  });
});
```

**Verification:**
```bash
cd c:/y/synergy-prompt-crafter
npm install
npm run test:run
# Should display test results
```

---

## Phase 5: Documentation Updates

### Step 5.1: Update README.md

**File to Modify:** `README.md`

**Current Content:**
```markdown
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
```

**Replace With:**
```markdown
# Synergy Prompt Crafter

Craft complex multidisciplinary prompts with AI assistance powered by Google's Gemini.

## Run Locally

**Prerequisites:** Node.js v18+

### Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure the API server:**

   The app requires a local proxy server to keep your API key secure. Create a `.env` file in the `server/` directory:

   ```bash
   cd server
   cp .env.example .env
   ```

   Edit `server/.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   PORT=3001
   ```

3. **Start the API server:**
   ```bash
   cd server
   npm install
   npm start
   ```
   The server runs on `http://localhost:3001`.

4. **Configure the frontend:**

   Edit [.env.local](.env.local) to point to the API server:
   ```
   VITE_API_BASE_URL=http://localhost:3001
   ```

5. **Run the app:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
├── components/          # Reusable React components
│   ├── stages/         # Stage-specific UI components
│   └── Toast.tsx       # Toast notification system
├── hooks/              # Custom React hooks
├── services/           # API service layer
├── server/             # Backend proxy server
├── plans/              # Analysis and planning documents
└── types.ts            # TypeScript type definitions
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests (watch mode) |
| `npm run test:run` | Run unit tests (single run) |

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Express.js (API proxy)
- **AI:** Google Gemini API (@google/genai)
- **Styling:** Tailwind CSS
```

---

## Phase 6: Final Verification

### Step 6.1: Run Full Build and Tests

**Commands:**
```bash
cd c:/y/synergy-prompt-crafter

# Clean install all dependencies
rm -rf node_modules package-lock.json
npm install

# Build the project
npm run build

# Run tests
npm run test:run

# Check bundle for API key exposure
grep -i "api_key" dist/assets/*.js || echo "No API_KEY found in bundle - GOOD"
grep -i "gemini" dist/assets/*.js | grep -iv "google.gemini" || echo "No Gemini key exposed - GOOD"
```

---

## Implementation Order Summary

| Step | Phase | Action | Files |
|------|-------|--------|-------|
| 1.1 | Security | Create API proxy server | `server/index.js`, `server/package.json`, `server/.env` |
| 1.2 | Security | Update geminiService.ts for proxy | `services/geminiService.ts` |
| 1.3 | Security | Remove API key from vite.config | `vite.config.ts` |
| 1.4 | Security | Update .env.local | `.env.local` |
| 2.1 | Architecture | Create useAsyncOperation hook | `hooks/useAsyncOperation.ts` |
| 2.2 | Architecture | Create Toast notification system | `components/Toast.tsx` |
| 2.3 | Architecture | Extract stage components | `components/stages/*.tsx` |
| 2.4 | Architecture | Update App.tsx with new components | `App.tsx` |
| 2.5 | Architecture | Add AbortController | `services/geminiService.ts` |
| 3.1 | Quality | Extract magic strings | `constants.ts` |
| 3.2 | Quality | Add debouncing | `hooks/useDebounce.ts` |
| 4.1 | Testing | Install test dependencies | `package.json`, configs |
| 4.2 | Testing | Create unit tests | `src/test/*.test.ts` |
| 5.1 | Docs | Update README.md | `README.md` |
| 6.1 | Verification | Run full build and tests | All files |

---

*Implementation plan complete. Execute each step in order. Each step's verification should pass before proceeding to the next step.*
