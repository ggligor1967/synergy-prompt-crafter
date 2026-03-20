# Changelog

All notable changes to Synergy Prompt Crafter are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added
- **Shared JSON parser** (`services/jsonParser.ts`) — centralised `parseJsonFromText<T>()` used by all providers.
- **Input sanitization** — `sanitize()` applied to all user inputs in `OllamaProvider` (was already present in `GeminiProvider`).
- **Documentation suite** — `README.md` rewritten; `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `API.md`, `CHANGELOG.md` created.

### Changed
- `GeminiProvider` now imports `parseJsonFromText` from `services/jsonParser` instead of a local copy.
- `OllamaProvider` now imports `parseJsonFromText` from `services/jsonParser` instead of a local copy.
- `geminiService.test.ts` updated to import `parseJsonFromText` from `services/jsonParser`.

---

## [0.1.0] — 2025-01-15

Initial release.

### Added

#### Core Wizard
- Five-stage prompt engineering workflow: Ideation → Concept Exploration → Prompt Construction → AI Refinement → Final Prompt.
- Stage progress bar with visual completion tracking.
- Stage navigation with validation guards.

#### AI Providers
- **Gemini** provider via Express proxy server (API key isolation).
- **Ollama** provider with direct browser-to-daemon communication.
- Strategy pattern (`AIProvider` interface) for provider interchangeability.
- Runtime provider switching with `localStorage` persistence.

#### Service Layer
- `generateConcepts()` — discipline-scoped concept generation.
- `refinePromptComponent()` — single-field refinement.
- `generatePromptVariations()` — full-prompt alternative generation.
- `suggestImprovements()` — prompt analysis and improvement suggestions.
- `generateFullPromptFromData()` — structured data → prose prompt synthesis.
- `testGeneratedPrompt()` — send final prompt and get AI response.
- `listModels()` — Ollama model discovery from `/api/tags`.

#### Components
- `ProviderSelector` — dropdown with status indicators.
- `SettingsPanel` — Ollama model picker modal with live model list.
- `ActionButton` — four visual variants (primary, secondary, success, danger).
- `StageProgressBar` — horizontal progress with stage labels.
- `Pill` — toggleable tag for discipline/concept selection.
- `Toast` / `ToastProvider` — auto-dismiss notification system (success, error, info, warning).
- `LoadingSpinner` — animated SVG spinner.
- 11 SVG icon components in `Icons.tsx`.

#### Server
- Express proxy at `localhost:3001` with `/api/gemini/generate-content` endpoint.
- Health check at `/api/health` with API key validation.
- CORS allowlist, 100KB body limit, 50K character cap on content.

#### Testing
- 61 tests across 5 suites (Vitest + Testing Library + jsdom).
- Coverage: JSON parsing, Ollama service, Gemini service, settings panel, stage navigation, async hook.

#### Configuration
- `VITE_API_BASE_URL` — Gemini proxy URL.
- `VITE_OLLAMA_URL` — Ollama daemon URL.
- `VITE_OLLAMA_MODEL` — default Ollama model.
- `GEMINI_API_KEY` — server-side Gemini key.

---

[Unreleased]: https://github.com/user/synergy-prompt-crafter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/user/synergy-prompt-crafter/releases/tag/v0.1.0
