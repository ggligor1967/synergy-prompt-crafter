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

### REST API + Prompt Store (Phase 4)

**`server/store.js`** — JSON file-based prompt store. `createStore(dbPath)` returns `{ getAll({search?}), getById(id), create(data), update(id, changes), delete(id) }`. `defaultStore` is pre-bound to `server/prompts.json` (gitignored). Factory pattern enables dependency injection in tests.

**`server/routes/prompts.js`** — `createPromptsRouter(store?)` factory returns an Express Router for `/api/prompts` CRUD. PUT strips `id`/`createdAt` from body to prevent overwriting.

**`server/app.js`** — `createApp({store?})` factory with CORS, rate limiting (30 req/min), optional X-API-Key auth, Gemini proxy, prompts router, OpenAPI spec at `/api/openapi.json`, and Swagger UI at `/api/docs` (CDN-hosted, no install).

**`server/index.js`** — just calls `createApp().listen(PORT)`.

### CLI Tool (`cli/`)

`cli/api.js` — pure async HTTP client (no side effects): `fetchPrompts`, `fetchPrompt`, `createPrompt`, `updatePrompt`, `deletePrompt`. Throws with HTTP status on error.

`cli/commands.js` — command handlers (`listCommand`, `getCommand`, `deleteCommand`, `exportCommand`, `createCommand`). All accept `{url, json?, ...}` options. `exportCommand` supports `json|markdown|text` formats. Sets `process.exitCode=1` on errors.

`cli/index.js` — Commander wiring. `SYNERGY_API_URL` env var overrides default `http://localhost:3001`.

### Express Proxy (`server/index.js`)
- `GET /api/health` — checks `GEMINI_API_KEY` is set
- `POST /api/gemini/generate-content` — proxies to Gemini with 100KB body limit and 50K character prompt cap

### `useAsyncOperation` Hook
Generic hook for async state: `{ data, error, isLoading, execute, reset, abort }`. Each `execute()` call creates a new `AbortController`; component unmount auto-aborts. Used in every stage component for AI calls.

### Constants & Debounce (Phase 3)
- **`constants.ts`**: `TOAST_MESSAGES` (all user-facing toast strings as typed constants), `VARIATION_ID_PREFIX`/`IMPROVEMENT_ID_PREFIX` (used in both service files to generate suggestion IDs).
- **`hooks/useDebounce.ts`**: Generic `useDebounce<T>(value, delay)` hook. Applied in `PromptHistory.tsx` on the search input (250ms delay). Tests use `vi.useFakeTimers()`.
- Search filter tests that assert post-debounce state use `waitFor` (real timers) so the 250ms debounce can fire naturally.

### Prompt History (Phase 2)
- **`services/storage.ts`** — IndexedDB via `idb`. CRUD: `savePrompt`, `updatePrompt`, `deletePrompt`, `getAllPrompts`, `toggleFavorite`. `_resetDB(null)` resets the cached DB handle (used in tests with `fake-indexeddb`).
- **`components/PromptHistory.tsx`** — Fixed right-panel sidebar. Features: search (title/coreIdea/prompt text), favorites filter, star/restore/delete-with-confirmation per record. Reloads when `refreshTrigger` prop increments.
- **`App.tsx`** — `handleSavePrompt` (saves from FinalPromptStage, increments `historyRefreshTrigger`), `handleRestorePrompt` (restores state and jumps to FINAL_PROMPT stage). History button in toolbar toggles the panel.
- **`FinalPromptStage.tsx`** — Optional `onSave` prop; when provided, renders "Save to History" button.

### Security (Phase 1)
- X-API-Key shared-secret on the Express proxy: set `API_SECRET` in `server/.env` and `VITE_API_SECRET` in `.env.local`. Auth is skipped when the env var is absent.
- `services/sanitize.ts` — strips HTML/XML tags and backticks; used by both AI providers before embedding user text in prompts.

## Test Structure

Tests live in `__tests__/` and use Vitest + jsdom + Testing Library. 236 tests, ~88% coverage:
- `geminiService.test.ts` — JSON parsing, provider status, `generateConcepts`
- `ollamaService.test.ts` — Full Ollama provider coverage including model listing
- `sanitize.test.ts` — HTML/XSS stripping, backtick replacement
- `storage.test.ts` — IndexedDB CRUD via `fake-indexeddb`
- `promptHistory.test.tsx` — Sidebar UI: search, favorites filter, restore, delete confirmation, refreshTrigger
- `settingsPanel.test.tsx` — Settings modal UI behavior
- `stageNavigation.test.ts` — Wizard forward/back navigation and boundary clamping
- `useAsyncOperation.test.ts` — Hook states (loading, data, error, reset, abort)
- `useDebounce.test.ts` — Timing behavior with fake timers
- `stages/IdeationStage.test.tsx` — Concept generation, custom discipline validation
- `stages/AIRefinementStage.test.tsx` — Variations, improvements, apply suggestion
- `server-store.test.ts` — Store CRUD with per-test isolated temp files
- `server-prompts.test.ts` — Express routes via `supertest` with per-test isolated store
- `server-app.test.ts` — `createApp()` factory: health, OpenAPI spec, Swagger UI, Gemini validation, API_SECRET auth
- `cli-api.test.ts` — HTTP client functions via `vi.stubGlobal('fetch', mockFetch)`
- `cli-commands.test.ts` — Command handlers: output format, `--json` mode, `process.exitCode=1` on error
