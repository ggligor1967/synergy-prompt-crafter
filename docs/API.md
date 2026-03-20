# API Reference

> Service layer and type definitions for Synergy Prompt Crafter

---

## Table of Contents

- [Types](#types)
- [AIProvider Interface](#aiprovider-interface)
- [GeminiProvider](#geminiprovider)
- [OllamaProvider](#ollamaprovider)
- [jsonParser](#jsonparser)
- [useAsyncOperation Hook](#useasyncoperation-hook)
- [Toast System](#toast-system)
- [Server Endpoints](#server-endpoints)

---

## Types

**File:** `types.ts`

### AppStage

```typescript
enum AppStage {
  IDEATION              = 'IDEATION',
  CONCEPT_EXPLORATION   = 'CONCEPT_EXPLORATION',
  PROMPT_CONSTRUCTION   = 'PROMPT_CONSTRUCTION',
  AI_REFINEMENT         = 'AI_REFINEMENT',
  FINAL_PROMPT          = 'FINAL_PROMPT',
}
```

### PromptData

Structured prompt fields collected in the Prompt Construction stage.

```typescript
interface PromptData {
  role: string;         // e.g. "An expert in quantum computing"
  context: string;      // Background information for the AI
  task: string;         // What the AI should do
  keywords: string[];   // Extracted from concepts or manually added
  constraints: string;  // Negative constraints, requirements
  tone: string;         // "Neutral" | "Formal" | "Creative" | ... (11 options)
  format: string;       // "Detailed text" | "Essay" | "JSON object" | ... (12 options)
  audience: string;     // "General" | "Experts" | "Beginners" | ...
}
```

### AiConcepts

```typescript
type AiConcepts = Record<string, string[]>;
// Example: { "Physics": ["Wave-particle duality", "Entanglement"], "Philosophy": ["Epistemology"] }
```

### RefinementSuggestion

```typescript
interface RefinementSuggestion {
  id: string;                        // Unique ID: "var-{timestamp}-{index}" or "imp-..."
  text: string;                      // The suggestion or variation text
  type: 'variation' | 'improvement'; // Category
}
```

### ProviderStatus

```typescript
interface ProviderStatus {
  configured: boolean;  // true if provider is reachable and functional
  error?: string;       // Human-readable error message if not configured
}
```

---

## AIProvider Interface

**File:** `services/aiProvider.ts`

The `AIProvider` interface defines the contract that all AI providers must implement. This enables the Strategy pattern used in `App.tsx`.

```typescript
interface AIProvider {
  name: string;
  id: string;
  status: () => Promise<ProviderStatus>;
  generateConcepts: (idea: string, disciplines: string[]) => Promise<AiConcepts>;
  refinePromptComponent: (componentType: string, currentText: string, context: string) => Promise<string>;
  generatePromptVariations: (fullPrompt: string, numberOfVariations?: number) => Promise<RefinementSuggestion[]>;
  suggestImprovements: (fullPrompt: string) => Promise<RefinementSuggestion[]>;
  generateFullPromptFromData: (promptData: PromptData, selectedDisciplines: string[], coreIdea: string) => Promise<string>;
  testGeneratedPrompt: (promptText: string) => Promise<string>;
}
```

### Method Reference

#### `status()`

Check if the provider is reachable and configured.

| | Details |
|---|---|
| **Returns** | `Promise<ProviderStatus>` |
| **Gemini** | Calls `GET /api/health` on the proxy server |
| **Ollama** | Calls `GET /api/tags` on the Ollama daemon |
| **Timeout** | 5 seconds |

#### `generateConcepts(idea, disciplines)`

Generate discipline-specific concepts for the Concept Exploration stage.

| Parameter | Type | Description |
|-----------|------|-------------|
| `idea` | `string` | The user's core idea |
| `disciplines` | `string[]` | Selected academic disciplines |

**Returns:** `Promise<AiConcepts>` — object mapping each discipline to an array of 2-4 concept strings.

**Errors:** Throws if response cannot be parsed as JSON.

#### `refinePromptComponent(componentType, currentText, context)`

Refine a single prompt field (role, context, task, etc.).

| Parameter | Type | Description |
|-----------|------|-------------|
| `componentType` | `string` | Field name (e.g. "role", "context") |
| `currentText` | `string` | Current value of the field |
| `context` | `string` | Surrounding prompt context |

**Returns:** `Promise<string>` — refined text for the specified field.

#### `generatePromptVariations(fullPrompt, numberOfVariations?)`

Generate alternative versions of the full prompt.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fullPrompt` | `string` | — | The current prompt text |
| `numberOfVariations` | `number` | `2` | How many variations to generate |

**Returns:** `Promise<RefinementSuggestion[]>` — array with `type: 'variation'`.

#### `suggestImprovements(fullPrompt)`

Analyze the prompt and suggest specific improvements.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fullPrompt` | `string` | The current prompt text |

**Returns:** `Promise<RefinementSuggestion[]>` — array with `type: 'improvement'`. Each suggestion includes the reasoning and revised text.

#### `generateFullPromptFromData(promptData, selectedDisciplines, coreIdea)`

Synthesize a complete prompt from structured form data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `promptData` | `PromptData` | All form fields |
| `selectedDisciplines` | `string[]` | Chosen disciplines |
| `coreIdea` | `string` | Original idea from Stage 1 |

**Returns:** `Promise<string>` — the complete synthesized prompt text.

#### `testGeneratedPrompt(promptText)`

Send the final prompt to the AI and return its response.

| Parameter | Type | Description |
|-----------|------|-------------|
| `promptText` | `string` | The prompt to test |

**Returns:** `Promise<string>` — the AI's response to the prompt.

---

## GeminiProvider

**File:** `services/geminiService.ts`

Routes all requests through the Express proxy server at `VITE_API_BASE_URL` (default: `http://localhost:3001`).

### Configuration

| Setting | Source | Default |
|---------|--------|---------|
| Proxy URL | `VITE_API_BASE_URL` env var | `http://localhost:3001` |
| Request timeout | Hard-coded | 60 seconds |

### Behavior

- All user inputs are sanitized via `sanitize()` (removes `<>` characters)
- JSON responses use `responseMimeType: 'application/json'` where applicable
- Parsed via shared `parseJsonFromText()` from `jsonParser.ts`
- Returns `{}` (empty object) for concepts when response is unparseable (does not throw)

---

## OllamaProvider

**File:** `services/ollamaService.ts`

Calls the locally-running Ollama daemon directly at `VITE_OLLAMA_URL` (default: `http://localhost:11434`).

### Configuration

| Setting | Source | Priority | Default |
|---------|--------|----------|---------|
| Ollama URL | `VITE_OLLAMA_URL` env var | — | `http://localhost:11434` |
| Model | `localStorage('ollamaModel')` → `VITE_OLLAMA_MODEL` env var → fallback | 1 → 2 → 3 | `llama3` |
| Request timeout | Hard-coded | — | 120 seconds |

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `OllamaProvider` | `AIProvider` | Main provider implementation |
| `listModels()` | `() => Promise<string[]>` | Fetches available model names from `/api/tags`. Returns `[]` on failure |
| `OLLAMA_MODEL_STORAGE_KEY` | `string` | localStorage key (`"ollamaModel"`) for model persistence |
| `parseJsonFromText` | Re-export | Re-exported from `jsonParser.ts` for backward compatibility |

### Behavior

- All user inputs are sanitized via `sanitize()` (removes `<>` characters)
- Uses `stream: false` for all requests (full response, not streaming)
- Throws on unparseable concept responses (unlike Gemini which returns `{}`)
- 120-second timeout via `AbortController` (longer than Gemini due to local model inference time)

---

## jsonParser

**File:** `services/jsonParser.ts`

### `parseJsonFromText<T>(text: string): T | null`

Extracts and parses JSON from LLM text responses. Handles:

1. **Pure JSON** — `{"key": "value"}`
2. **Markdown fenced blocks** — `` ```json\n{...}\n``` ``
3. **JSON embedded in prose** — `"Here is your result:\n{...}\nEnd."`

**Returns** `null` if no valid JSON can be extracted.

**Algorithm:**
1. Strip markdown fences via regex
2. Extract first `{...}` or `[...]` block from surrounding text
3. Attempt `JSON.parse()`
4. On failure, retry with original trimmed text
5. Return `null` if all attempts fail

---

## useAsyncOperation Hook

**File:** `hooks/useAsyncOperation.ts`

Generic hook for wrapping any async function with loading/error/data state management.

### Signature

```typescript
function useAsyncOperation<T, A extends unknown[]>(
  asyncFn: (...args: A) => Promise<T>
): {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  execute: (...args: A) => Promise<T>;
  reset: () => void;
}
```

### Behavior

| Event | `data` | `error` | `isLoading` |
|-------|--------|---------|-------------|
| Initial | `null` | `null` | `false` |
| `execute()` called | `null` | `null` | `true` |
| Success | result | `null` | `false` |
| Failure | `null` | error message | `false` |
| `reset()` called | `null` | `null` | `false` |

**Note:** `execute()` re-throws the error after storing it, allowing callers to catch it in `try/catch` blocks.

---

## Toast System

**File:** `components/Toast.tsx`

### ToastProvider

Wrap the app in `<ToastProvider>` to enable toast notifications.

### useToast()

```typescript
const { showToast } = useToast();

showToast('Message text', 'success');   // 'success' | 'error' | 'info' | 'warning'
showToast('Default info toast');         // type defaults to 'info'
```

- Toasts auto-dismiss after **4 seconds**
- Displayed as a stacked column in the bottom-right corner
- Each toast has a manual dismiss (×) button
- Fade-in animation on appearance

---

## Server Endpoints

**Base URL:** `http://localhost:3001` (configurable via `PORT` env var)

### `GET /api/health`

Health check endpoint.

| Response | Status | Body |
|----------|--------|------|
| API key configured | `200` | `{ "ok": true }` |
| API key missing | `503` | `{ "ok": false, "error": "GEMINI_API_KEY not configured on server." }` |

### `POST /api/gemini/generate-content`

Forward a generation request to the Gemini API.

**Request body:**

```json
{
  "contents": "prompt text or structured content",
  "config": {
    "temperature": 0.7,
    "responseMimeType": "application/json"
  }
}
```

**Validation:**
- `contents` is required (400 if missing)
- `contents` must be ≤ 50,000 characters (400 if exceeded)
- Request body must be ≤ 100KB

**Response:**

| Status | Body |
|--------|------|
| `200` | `{ "text": "generated response..." }` |
| `400` | `{ "error": "validation message" }` |
| `500` | `{ "error": "An error occurred while processing your request." }` |

**Note:** Internal error details are logged server-side but never exposed to the client.
