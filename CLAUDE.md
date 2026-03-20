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
Generic hook for async state: `{ data, error, isLoading, execute, reset }`. Used throughout `App.tsx` for all AI calls.

## Test Structure

Tests live in `__tests__/` and use Vitest + jsdom + Testing Library. 61 tests across 5 suites:
- `geminiService.test.ts` — JSON parsing, provider status, `generateConcepts`
- `ollamaService.test.ts` — Full Ollama provider coverage including model listing
- `settingsPanel.test.tsx` — Settings modal UI behavior
- `stageNavigation.test.ts` — Wizard forward/back navigation and boundary clamping
- `useAsyncOperation.test.ts` — Hook states (loading, data, error, reset)
