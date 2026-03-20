# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (root)
```bash
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # Production build
npm run preview    # Preview production build
npm test           # Vitest watch mode
npm run test:run   # Single-pass test run (CI)
```

### Express proxy server (server/)
```bash
cd server && npm start      # Start proxy at http://localhost:3001
cd server && npm run dev    # Start with --watch mode
```

### Running a single test file
```bash
npx vitest run __tests__/ollamaService.test.ts
```

## Setup

Two separate Node processes must run concurrently:

1. **Frontend:** `npm run dev` (root)
2. **Express proxy:** `cd server && npm start`

Environment config:
- **Client:** Copy `.env.local` — sets `VITE_API_BASE_URL`, `VITE_OLLAMA_URL`, `VITE_OLLAMA_MODEL`
- **Server:** Copy `server/.env.example` to `server/.env` — sets `GEMINI_API_KEY`, `PORT`, `ALLOWED_ORIGINS`

## Architecture

### 5-Stage Wizard Flow

`AppStage` enum (in `types.ts`) drives the entire UI: `IDEATION → CONCEPT_EXPLORATION → PROMPT_CONSTRUCTION → AI_REFINEMENT → FINAL_PROMPT`. All wizard state lives in `App.tsx` and is passed down as props.

### AI Provider Strategy Pattern

All AI calls go through the `AIProvider` interface (`services/aiProvider.ts`). Two implementations:

- **GeminiProvider** (`geminiService.ts`) — POSTs to Express proxy at `:3001`, which forwards to the Gemini API using `gemini-2.5-flash-preview-04-17`. The API key never reaches the browser.
- **OllamaProvider** (`ollamaService.ts`) — Direct HTTP to local Ollama daemon at `:11434`. Model selection persisted in `localStorage`.

Provider is selected at runtime via toggle in the UI; selection also persists to `localStorage`.

### JSON Parsing from AI Responses

`services/jsonParser.ts` handles AI responses that mix prose and JSON. It tries: markdown-fenced JSON → embedded JSON object → raw parse. Always use this when parsing structured AI output.

### Key Data Types (`types.ts`)
- `PromptData` — the 8-field prompt form (role, context, task, keywords, constraints, tone, format, audience)
- `AiConcepts` — `Record<string, string[]>` mapping discipline names to concept arrays
- `RefinementSuggestion` — `{ id, text, type: 'variation' | 'improvement' }`

### Express Proxy (`server/index.js`)
- `GET /api/health` — checks `GEMINI_API_KEY` is set
- `POST /api/gemini/generate-content` — proxies to Gemini with 100KB body limit and 50K character prompt cap

### `useAsyncOperation` Hook
Generic hook for async state: `{ data, error, isLoading, execute, reset, abort }`. Each `execute()` call creates a new `AbortController`; component unmount auto-aborts. Used in every stage component for AI calls.

### Prompt History (Phase 2)
- **`services/storage.ts`** — IndexedDB via `idb`. CRUD: `savePrompt`, `updatePrompt`, `deletePrompt`, `getAllPrompts`, `toggleFavorite`. `_resetDB(null)` resets the cached DB handle (used in tests with `fake-indexeddb`).
- **`components/PromptHistory.tsx`** — Fixed right-panel sidebar. Features: search (title/coreIdea/prompt text), favorites filter, star/restore/delete-with-confirmation per record. Reloads when `refreshTrigger` prop increments.
- **`App.tsx`** — `handleSavePrompt` (saves from FinalPromptStage, increments `historyRefreshTrigger`), `handleRestorePrompt` (restores state and jumps to FINAL_PROMPT stage). History button in toolbar toggles the panel.
- **`FinalPromptStage.tsx`** — Optional `onSave` prop; when provided, renders "Save to History" button.

### Security (Phase 1)
- X-API-Key shared-secret on the Express proxy: set `API_SECRET` in `server/.env` and `VITE_API_SECRET` in `.env.local`. Auth is skipped when the env var is absent.
- `services/sanitize.ts` — strips HTML/XML tags and backticks; used by both AI providers before embedding user text in prompts.

## Test Structure

Tests live in `__tests__/` and use Vitest + jsdom + Testing Library. 164 tests, 82% coverage:
- `geminiService.test.ts` — JSON parsing, provider status, `generateConcepts`
- `ollamaService.test.ts` — Full Ollama provider coverage including model listing
- `sanitize.test.ts` — HTML/XSS stripping, backtick replacement
- `storage.test.ts` — IndexedDB CRUD via `fake-indexeddb` (sets `globalThis.indexedDB = new IDBFactory()` in `beforeEach`)
- `promptHistory.test.tsx` — Sidebar UI: search, favorites filter, restore, delete confirmation, refreshTrigger
- `settingsPanel.test.tsx` — Settings modal UI behavior
- `stageNavigation.test.ts` — Wizard forward/back navigation and boundary clamping
- `useAsyncOperation.test.ts` — Hook states (loading, data, error, reset, abort)
- `stages/IdeationStage.test.tsx` — Concept generation, custom discipline validation
- `stages/AIRefinementStage.test.tsx` — Variations, improvements, apply suggestion
