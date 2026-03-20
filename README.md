# Synergy Prompt Crafter

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](#tech-stack)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](#tech-stack)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](#tech-stack)
[![Tests](https://img.shields.io/badge/Tests-61_passing-brightgreen)](#running-tests)
[![License](https://img.shields.io/badge/License-Private-lightgrey)](#license)

A multidisciplinary AI prompt engineering tool built with React 19, TypeScript, and Vite. Walk through a guided **5-stage wizard** to craft richly structured prompts, then refine and test them using either **Google Gemini** (via a local proxy server) or a locally-running **Ollama** model.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Documentation](#documentation)
- [Security](#security)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Features

| Feature | Description |
|---------|-------------|
| **5-stage wizard** | Ideation → Concept Exploration → Prompt Construction → AI Refinement → Final Prompt |
| **Multi-provider support** | Switch between Gemini (Cloud) and Ollama (Local) at runtime; selection persists across sessions |
| **AI Concept Exploration** | Generate discipline-specific concepts from your core idea across 20+ academic disciplines |
| **Prompt construction form** | Structured fields — role, context, task, audience, tone, format, constraints, keywords |
| **AI refinement** | Generate prompt variations and improvement suggestions powered by the active provider |
| **Live prompt test** | Send the finished prompt to the active AI and view the response in-app |
| **Settings panel** | Configure Ollama model selection with live model list from local instance |
| **Toast notifications** | Non-blocking feedback for copy, provider switch, and error events |
| **Provider status indicators** | Real-time online/offline/checking badges for each provider |

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- For Gemini: a valid [Google Gemini API key](https://aistudio.google.com/app/apikey)
- For Ollama: [Ollama](https://ollama.com) installed locally with at least one model pulled

### Option A — Gemini (Cloud)

```bash
# Terminal 1 — proxy server
cd server
cp .env.example .env          # add your GEMINI_API_KEY inside .env
npm install
npm start                     # http://localhost:3001

# Terminal 2 — React dev server
npm install
npm run dev                   # http://localhost:5173
```

Select **Gemini (Cloud)** in the provider bar — it shows green when the proxy is reachable and the API key is configured.

### Option B — Ollama (Local)

```bash
ollama serve                  # start the Ollama daemon
ollama pull llama3            # download model (one-time)

# React dev server (proxy not needed)
npm install
npm run dev
```

Select **Ollama (Local)** in the provider bar. Model and URL are configurable in Settings or `.env.local`.

---

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed diagrams, data flow, and design decisions.

```
synergy-prompt-crafter/
├── App.tsx                     # Root component — wizard state, provider selection
├── index.tsx                   # Entry point, wraps App in ToastProvider
├── types.ts                    # Shared TypeScript types and enums
├── constants.ts                # Disciplines, tones, formats, initial state
├── services/
│   ├── aiProvider.ts           # AIProvider interface (implemented by both providers)
│   ├── geminiService.ts        # GeminiProvider — fetches through server/ proxy
│   ├── ollamaService.ts        # OllamaProvider — fetches directly to localhost:11434
│   └── jsonParser.ts           # Shared JSON extraction from LLM text responses
├── hooks/
│   └── useAsyncOperation.ts    # Generic async state hook (data / error / isLoading)
├── components/
│   ├── ProviderSelector.tsx    # Pill button group with status indicators
│   ├── SettingsPanel.tsx       # Ollama model selection modal
│   ├── Toast.tsx               # ToastProvider + useToast context hook
│   ├── ActionButton.tsx        # Styled button component (4 variants)
│   ├── Pill.tsx                # Removable tag chip
│   ├── StageProgressBar.tsx    # Wizard stage progress indicator
│   ├── LoadingSpinner.tsx      # Animated spinner
│   └── Icons.tsx               # 11 SVG icon components
├── server/                     # Express proxy (keeps API key server-side)
│   ├── index.js                # /api/health + /api/gemini/generate-content
│   ├── package.json
│   └── .env.example
├── __tests__/                  # Vitest test suites (61 tests)
└── plans/                      # Design & integration planning documents
```

---

## Configuration

### Environment Variables

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | client | `http://localhost:3001` | Base URL of the Express proxy |
| `VITE_OLLAMA_URL` | client | `http://localhost:11434` | Ollama daemon URL |
| `VITE_OLLAMA_MODEL` | client | `llama3` | Default Ollama model (overridden by Settings panel) |
| `GEMINI_API_KEY` | server | — | Google Gemini API key (**never sent to client**) |
| `PORT` | server | `3001` | Proxy server port |
| `ALLOWED_ORIGINS` | server | `http://localhost:5173` | Comma-separated CORS origins |

- Client variables → `.env.local` (root)
- Server variables → `server/.env`

### Runtime Settings

The **Settings** panel (gear icon) allows changing the Ollama model at runtime. The selection is persisted in `localStorage` under the `ollamaModel` key.

---

## Running Tests

```bash
npm run test:run      # single pass (CI-friendly)
npm test              # watch mode (development)
```

**Test coverage — 61 tests across 5 suites:**

| File | Tests | Coverage |
|---|---|---|
| `geminiService.test.ts` | 12 | `parseJsonFromText` · `GeminiProvider.status` · `GeminiProvider.generateConcepts` |
| `ollamaService.test.ts` | 23 | `parseJsonFromText` · `OllamaProvider.status` · `OllamaProvider.generateConcepts` · `listModels` · model resolution |
| `settingsPanel.test.tsx` | 11 | Rendering · model selection · close behaviour |
| `stageNavigation.test.ts` | 6 | Forward/backward navigation · boundary clamping |
| `useAsyncOperation.test.ts` | 9 | Initial state · loading · data/error · re-throw · reset |

---

## Documentation

| Document | Description |
|---|---|
| [README.md](README.md) | Project overview, quick start, configuration |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, component diagrams, data flow, design decisions |
| [docs/API.md](docs/API.md) | Service layer API reference — provider interface, methods, types |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Development workflow, coding standards, PR conventions |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history and release notes |

---

## Security

- The Gemini API key is stored only in `server/.env` and **never** sent to the browser.
- The Express proxy uses a CORS allowlist — only specified origins are permitted.
- `VITE_*` variables are build-time constants and must contain no secrets.
- All user inputs are sanitized (HTML tag removal) before being sent to AI providers.
- Request size is limited to 100KB on the server, with a 50K character cap on prompt content.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 19.1 |
| Language | TypeScript | 5.7 |
| Build Tool | Vite | 6.2 |
| Styling | Tailwind CSS | CDN |
| Testing | Vitest + Testing Library | 3.x / 16.x |
| Server | Express | 4.21 |
| AI (Cloud) | Google Gemini (`@google/genai`) | 1.4 |
| AI (Local) | Ollama | Latest |

---

## License

Private — all rights reserved.

