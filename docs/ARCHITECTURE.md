# Architecture

> Last updated: 2026-03-20 · Synergy Prompt Crafter v0.1.0

---

## System Overview

Synergy Prompt Crafter is a single-page React application that guides users through a 5-stage wizard to compose, refine, and test multidisciplinary AI prompts. It communicates with two interchangeable AI backends via a **Strategy pattern** — the active provider can be swapped at runtime without any code path changes.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React SPA)                      │
│                                                                 │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │ App.tsx   │──▶│ AIProvider   │──▶│ GeminiProvider       │────┼──▶ Express Proxy ──▶ Gemini API
│  │ (wizard)  │   │ (interface)  │   └──────────────────────┘    │    :3001               (cloud)
│  │           │   │              │   ┌──────────────────────┐    │
│  │           │   │              │──▶│ OllamaProvider       │────┼──▶ Ollama Daemon
│  └──────────┘   └──────────────┘   └──────────────────────┘    │    :11434 (local)
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why two different communication paths?

| Provider | Path | Reason |
|----------|------|--------|
| **Gemini** | Browser → Express proxy → Google API | API key must stay server-side; proxy holds `GEMINI_API_KEY` in `server/.env` |
| **Ollama** | Browser → Ollama daemon directly | Runs locally on the same machine — no secrets to protect, no proxy overhead needed |

---

## Wizard Stages

The application models a linear 5-stage workflow via the `AppStage` enum:

```
┌────────────┐    ┌───────────────────┐    ┌─────────────────────┐
│  IDEATION  │───▶│ CONCEPT_EXPLORATION│───▶│ PROMPT_CONSTRUCTION │
│            │    │                   │    │                     │
│ Core idea  │    │ AI-generated      │    │ Role, context, task │
│ Discipline │    │ concepts per      │    │ audience, tone,     │
│ selection  │    │ discipline        │    │ format, keywords    │
└────────────┘    └───────────────────┘    └─────────┬───────────┘
                                                     │
                                                     ▼
                  ┌───────────────────┐    ┌─────────────────────┐
                  │   FINAL_PROMPT    │◀───│   AI_REFINEMENT     │
                  │                   │    │                     │
                  │ Copy / Test /     │    │ Variations &        │
                  │ Start new         │    │ improvements        │
                  └───────────────────┘    └─────────────────────┘
```

**Stage transitions** are managed by `handleNextStage()` / `handlePrevStage()` in `App.tsx`, with boundary clamping (cannot go before stage 1 or past stage 5).

---

## Component Architecture

### Component Tree

```
<React.StrictMode>
  <ToastProvider>                          # Context provider for toast notifications
    <App>                                  # Root — all wizard state lives here
      ├── <StageProgressBar />             # Visual progress indicator (1–5)
      ├── <ProviderSelector />             # Gemini / Ollama toggle with status dots
      ├── <SettingsPanel />                # Modal — Ollama model picker (conditional)
      │
      ├── Stage: IDEATION
      │   ├── <textarea>                   # Core idea input
      │   ├── <Pill /> × N                 # Discipline tags (predefined + custom)
      │   └── <ActionButton>               # "Explore Concepts"
      │
      ├── Stage: CONCEPT_EXPLORATION
      │   ├── Discipline cards × N         # AI-generated concepts
      │   └── <ActionButton> × 2           # Back / Continue
      │
      ├── Stage: PROMPT_CONSTRUCTION
      │   ├── Form fields                  # role, context, task, audience, tone, format, constraints
      │   ├── <Pill /> × N                 # Keyword tags
      │   └── <ActionButton>               # "Generate & Refine"
      │
      ├── Stage: AI_REFINEMENT
      │   ├── Prompt display               # Current generated prompt
      │   ├── <ActionButton> × 2           # Variations / Improvements
      │   ├── Suggestion cards × N         # "Use This" buttons
      │   └── <ActionButton> × 2           # Back / Finalize
      │
      └── Stage: FINAL_PROMPT
          ├── Prompt display (read-only)   # Green border
          ├── <ActionButton>               # Copy to clipboard
          ├── <ActionButton>               # Test with AI
          ├── Test response display         # Conditional
          └── <ActionButton>               # Start New
    </App>
  </ToastProvider>
</React.StrictMode>
```

### Component Inventory

| Component | File | Purpose |
|-----------|------|---------|
| `App` | `App.tsx` | Root. Owns all state: wizard stage, user inputs, AI outputs, provider selection |
| `ProviderSelector` | `components/ProviderSelector.tsx` | Pill button group showing each provider with colored status dot |
| `SettingsPanel` | `components/SettingsPanel.tsx` | Modal for Ollama model selection. Fetches live model list from `/api/tags` |
| `StageProgressBar` | `components/StageProgressBar.tsx` | Numbered step indicator with completed/active/upcoming states |
| `ActionButton` | `components/ActionButton.tsx` | Styled button with 4 variants: `primary`, `secondary`, `danger`, `ghost` |
| `Pill` | `components/Pill.tsx` | Tag chip with optional `onRemove` handler for keyword/discipline display |
| `Toast` / `ToastProvider` | `components/Toast.tsx` | Context-based toast system. Auto-dismiss after 4 seconds |
| `LoadingSpinner` | `components/LoadingSpinner.tsx` | Animated CSS spinner with configurable size |
| `Icons` | `components/Icons.tsx` | 11 SVG icon components (Sparkles, LightBulb, Arrows, Clipboard, Refresh, etc.) |

---

## Service Layer

### AIProvider Interface (Strategy Pattern)

Both providers implement `AIProvider` from `services/aiProvider.ts`:

```typescript
interface AIProvider {
  name: string;                    // Display name ("Gemini (Cloud)" / "Ollama (Local)")
  id: string;                      // Identifier ("gemini" / "ollama")
  status()                         // Check if provider is reachable & configured
  generateConcepts(idea, disc.)    // Stage 2: discipline → concepts mapping
  refinePromptComponent(...)       // Refine a single prompt field
  generatePromptVariations(...)    // Stage 4: N prompt variations
  suggestImprovements(...)         // Stage 4: improvement suggestions
  generateFullPromptFromData(...)  // Stage 3→4: synthesize full prompt from form data
  testGeneratedPrompt(...)         // Stage 5: test prompt with AI
}
```

`App.tsx` resolves `activeProvider` from the selected ID and calls methods on it. Switching providers requires no logic changes — only the underlying HTTP target changes.

### Service Files

| File | Responsibility |
|------|---------------|
| `services/aiProvider.ts` | `AIProvider` interface + `ProviderStatus` type |
| `services/geminiService.ts` | `GeminiProvider` — routes all calls through Express proxy (`/api/gemini/*`) |
| `services/ollamaService.ts` | `OllamaProvider` — calls Ollama directly. Exports `listModels()`, `OLLAMA_MODEL_STORAGE_KEY` |
| `services/jsonParser.ts` | Shared `parseJsonFromText<T>()` — extracts JSON from fenced blocks, prose, or raw text |

### JSON Parsing Strategy

LLM responses are unpredictable — they may return:
- Pure JSON
- JSON wrapped in markdown code fences (` ```json ... ``` `)
- JSON embedded in surrounding prose text

`parseJsonFromText<T>()` handles all three cases via:
1. Strip markdown fences (regex)
2. Extract first `{...}` or `[...]` block from surrounding text (regex)
3. Attempt `JSON.parse()`
4. Fall back to parsing the original trimmed text
5. Return `null` on all failures

Both providers use this same module, ensuring consistent parsing behaviour.

### Input Sanitization

Both providers sanitize user inputs before including them in prompts:

```typescript
const sanitize = (s: string): string => s.replace(/[<>]/g, '').trim();
```

This prevents HTML/XML injection into prompt strings.

---

## State Management

All state lives in `App.tsx` via React `useState` hooks — no external state library is used.

### State Categories

| Category | State Variables | Persistence |
|----------|----------------|-------------|
| **Provider** | `selectedProviderId`, `providerStatuses` | `localStorage('selectedProviderId')` |
| **Settings** | `showSettings`, `selectedOllamaModel` | `localStorage('ollamaModel')` |
| **Wizard** | `currentStage` | In-memory only |
| **User Input** | `coreIdea`, `selectedDisciplines`, `customDiscipline`, `promptData` | In-memory only |
| **AI Output** | `aiConcepts`, `generatedPrompt`, `refinementSuggestions` | In-memory only |
| **Async Ops** | `conceptsOp`, `fullPromptOp`, `variationsOp`, `improvementsOp`, `testPromptOp` | Via `useAsyncOperation` hook |

### useAsyncOperation Hook

A generic hook that wraps any `async` function with standardized loading/error/data state:

```typescript
const { data, error, isLoading, execute, reset } = useAsyncOperation(asyncFn);
```

Used for all 5 AI operations in `App.tsx`, providing consistent error handling and loading indicators.

---

## Server Architecture

The Express proxy server (`server/index.js`) exists solely to keep the Gemini API key off the client.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Returns `{ ok: true }` or `503` if API key is missing |
| `POST` | `/api/gemini/generate-content` | Forwards `{ contents, config }` to Gemini API, returns `{ text }` |

### Security Measures

| Measure | Implementation |
|---------|---------------|
| API key isolation | `GEMINI_API_KEY` in `server/.env`, never exposed via any endpoint |
| CORS allowlist | `ALLOWED_ORIGINS` env var, defaults to `localhost:5173` |
| Request size limit | `express.json({ limit: '100kb' })` |
| Content length cap | Rejects `contents` > 50,000 characters |
| Error masking | Internal errors return generic message, details logged server-side |

---

## Data Flow

### Complete Prompt Creation Flow

```
User enters idea + selects disciplines
          │
          ▼
  ┌─ activeProvider.generateConcepts() ─┐
  │   Sends idea + disciplines to AI    │
  │   Returns: { discipline: [...] }    │
  └─────────────────────────────────────┘
          │
          ▼
User clicks concepts → adds as keywords
User fills prompt form fields
          │
          ▼
  ┌─ activeProvider.generateFullPromptFromData() ─┐
  │   Sends all form data to AI                    │
  │   Returns: synthesized prompt string           │
  └────────────────────────────────────────────────┘
          │
          ▼
  ┌─ activeProvider.generatePromptVariations() ─┐
  │ activeProvider.suggestImprovements()         │
  │   Returns: RefinementSuggestion[]            │
  └─────────────────────────────────────────────┘
          │
          ▼
User selects a suggestion → replaces prompt
          │
          ▼
  ┌─ activeProvider.testGeneratedPrompt() ─┐
  │   Sends final prompt to AI              │
  │   Returns: AI response text             │
  └─────────────────────────────────────────┘
```

---

## Design Decisions

### Why no proxy for Ollama?

Ollama runs locally on the same machine as the browser — there is no API key to protect. Adding a proxy would:
- Add an unnecessary network hop (2× latency)
- Require the Express server to be running even for local-only usage
- Add complexity with no security benefit

### Why Tailwind via CDN?

The project uses `<script src="https://cdn.tailwindcss.com">` in `index.html`. This avoids build-time Tailwind configuration and keeps the setup minimal for a development/prototyping tool.

### Why no state management library?

All state is colocated in `App.tsx`. The wizard is a linear flow with no cross-cutting state concerns. React `useState` + `useAsyncOperation` is sufficient and avoids unnecessary dependencies.

### Why Strategy pattern for providers?

Adding a new AI provider requires only:
1. Implement the `AIProvider` interface
2. Add the provider to the `ALL_PROVIDERS` array in `App.tsx`

No switch statements, no conditional logic — the active provider is resolved once and all calls go through it.
