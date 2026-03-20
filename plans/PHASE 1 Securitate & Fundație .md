PHASE 1: Securitate & Fundație (Săptămânile 1-3)
Blocantă — nicio funcționalitate nouă până nu e completă.

Step	Task	Fișiere cheie	Paralelism
1.1	Security hardening: Extinde sanitize() pentru template literals, adaugă sanitizare output (DOMPurify), adaugă X-API-Key shared-secret pe server, curăță log-urile	geminiService.ts, ollamaService.ts, index.js	Independent
1.2	Refactor App.tsx: Extrage 5 stage containers (IdeationStage, ConceptExplorationStage, etc.), mută hook-urile useAsyncOperation în fiecare stage. App.tsx devine orchestrator <150 linii	App.tsx → noi components/stages/*.tsx	Paralel cu 1.1
1.3	Curăță cod mort: Elimină refinePromptComponent() nefolosit, iconuri nefolosite, standardizează strategia de erori (always-throw)	aiProvider.ts, ambii provideri, Icons.tsx	Paralel cu 1.1, 1.2
1.4	Expand teste: Teste pentru stage containers, edge cases sanitizare, test integrare wizard flow complet. Target: >80% coverage	__tests__ noi fișiere	Depinde de 1.2, 1.3
1.5	Request cancellation: AbortController în useAsyncOperation, abort la navigare/unmount	useAsyncOperation.ts, stage containers	Depinde de 1.2
PHASE 2: Persistență & Management Prompt-uri (Săptămânile 4-6)
Nr. 1 cerere utilizator: să nu piardă munca la refresh.

Step	Task	Dependență
2.1	IndexedDB storage layer via idb library. Schema: prompts store cu id, title, coreIdea, promptData, generatedPrompt, disciplines, tags, timestamps, isFavorite	Nou: services/storage.ts
2.2	Prompt History UI — sidebar cu lista de prompt-uri salvate, search/filter, click pentru restaurare, delete cu confirmare	Depinde de 2.1
2.3	Auto-save draft — salvare automată la 30s (debounced), restaurare la load	Depinde de 2.1
2.4	Export/Import — JSON (portabil, re-importabil), Markdown (lizibil), Plain text. Import din fișier JSON	Depinde de 2.1
Decizie: IndexedDB > SQLite — rămâne client-side, fără dependență server. SQLite doar în Phase 4 dacă e nevoie de REST API cu storage server-side.

PHASE 3: Inteligență & UX (Săptămânile 7-10)
Step	Task	Paralelism
3.1	Sistem de template-uri — template-uri predefinite (blog post, code review, research, creative writing). "Start from Template" în Ideation	Independent
3.2	Streaming responses — Ollama streaming nativ, Gemini via SSE proxy. Tokeni afișați incremental	Paralel cu 3.1
3.3	Parametri AI configurabili — slider temperatură, max_tokens, selecție model Gemini în Settings	Paralel cu 3.1, 3.2
3.4	Diff & version history — vizualizare diff (adăugat=verde, șters=roșu) la refinement, versiuni per prompt în IndexedDB	Depinde de Phase 2
3.5	Keyboard shortcuts & a11y — Ctrl+Enter, Escape, Ctrl+S, ARIA labels, focus management	Paralel
3.6	Provider OpenAI-compatible — suport pentru orice API OpenAI-compat (OpenAI, Azure OpenAI, vLLM, LM Studio)	Paralel
PHASE 4: API & Integrare (Săptămânile 11-14)
Step	Task	Dependență
4.1	REST API — CRUD prompts + generate endpoints pe Express. OpenAPI/Swagger docs	Server-side storage needed
4.2	CLI tool — npx synergy-prompt create/list/generate/export	Depinde de 4.1
4.3	Prompt as Code — .prompt.yaml / .prompt.json file format, parse & load în wizard	Paralel cu 4.1
VERIFICARE
Phase 1: npm run test:run trece, zero input nesanitizat în AI prompts, server respinge fără X-API-Key, App.tsx <150 linii, navigare în timp ce AI lucrează → request abortat

Phase 2: Salvare → refresh → prompt persistă; draft auto-restore; export JSON → import → toate câmpurile restaurate; delete funcționează

Phase 3: Template pre-fill corect; streaming tokens vizibili incremental; temperature change reflectat în request; diff vizibil; Ctrl+Enter/Escape funcționează; screen reader navigare completă

Phase 4: curl POST/GET /api/prompts funcționează; CLI creează prompt; OpenAPI spec validează

DECIZII CHEIE
IndexedDB (nu SQLite) pentru Phase 2 — client-side, zero server dependency
Always-throw error strategy — consistent, useAsyncOperation prinde totul
Shared-secret auth (nu JWT/OAuth) — cel mai simplu securizat pentru tool single-user
Props lifting (nu Redux/Zustand) — consistent cu pattern-urile existente
Streaming Ollama first (nativ) → apoi Gemini (necesită SSE proxy)
Phase 1 este blocantă — nicio funcționalitate până securitatea și arhitectura sunt solide
Claude Opus 4.6 • 3x