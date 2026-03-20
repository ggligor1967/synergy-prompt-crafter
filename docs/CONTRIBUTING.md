# Contributing

> Guidelines for contributing to Synergy Prompt Crafter

---

## Development Setup

```bash
# Clone and install
git clone <repository-url>
cd synergy-prompt-crafter
npm install

# Install server dependencies
cd server
npm install
cd ..

# Start development
npm run dev          # React dev server on :5173
```

For Gemini support, also start the proxy:
```bash
cd server
cp .env.example .env   # add GEMINI_API_KEY
npm run dev             # Express proxy on :3001 (with --watch)
```

---

## Project Structure Conventions

### File Organization

| Directory | Contains | Naming |
|-----------|----------|--------|
| `services/` | AI provider implementations, shared utilities | `camelCase.ts` |
| `components/` | React components | `PascalCase.tsx` |
| `hooks/` | Custom React hooks | `useCamelCase.ts` |
| `__tests__/` | Test files | `originalName.test.ts(x)` |
| `server/` | Express proxy server | `camelCase.js` |
| `docs/` | Project documentation | `UPPERCASE.md` |

### Code Style

- **TypeScript strict mode** — no `any`, no unused variables/parameters
- **Functional components** — no class components
- **Named exports** preferred for utilities; default exports for components
- **No external state library** — state lives in `App.tsx` via `useState`
- **Tailwind CSS** — utility classes inline, no separate CSS files

### Import Order

```typescript
// 1. React / framework imports
import React, { useState, useEffect } from 'react';

// 2. Types
import { AppStage, PromptData } from './types';

// 3. Services
import { GeminiProvider } from './services/geminiService';

// 4. Hooks
import { useAsyncOperation } from './hooks/useAsyncOperation';

// 5. Components
import ActionButton from './components/ActionButton';
```

---

## Adding a New AI Provider

1. **Create the service file** — `services/newProviderService.ts`
2. **Implement `AIProvider`** from `services/aiProvider.ts`:
   ```typescript
   import { AIProvider } from './aiProvider';

   export const NewProvider: AIProvider = {
     name: 'New Provider',
     id: 'new-provider',
     status: async () => { /* ... */ },
     generateConcepts: async (idea, disciplines) => { /* ... */ },
     refinePromptComponent: async (type, text, ctx) => { /* ... */ },
     generatePromptVariations: async (prompt, n) => { /* ... */ },
     suggestImprovements: async (prompt) => { /* ... */ },
     generateFullPromptFromData: async (data, disc, idea) => { /* ... */ },
     testGeneratedPrompt: async (prompt) => { /* ... */ },
   };
   ```
3. **Register in `App.tsx`**:
   ```typescript
   import { NewProvider } from './services/newProviderService';
   const ALL_PROVIDERS: AIProvider[] = [GeminiProvider, OllamaProvider, NewProvider];
   ```
4. **Add tests** — minimum: `status()`, `generateConcepts()`, JSON parsing edge cases
5. **Use `parseJsonFromText`** from `services/jsonParser.ts` for all LLM JSON responses
6. **Apply `sanitize()`** to all user-provided string inputs before including in prompts

---

## Testing

### Running Tests

```bash
npm run test:run      # Single pass (CI)
npm test              # Watch mode
```

### Test Conventions

- **Framework**: Vitest + `@testing-library/react` + `jest-dom`
- **Environment**: jsdom (configured in `vitest.config.ts`)
- **Mocking**: Use `vi.stubGlobal('fetch', vi.fn())` for HTTP calls — no real network requests
- **Cleanup**: Always `vi.unstubAllGlobals()` in `afterEach`
- **File location**: `__tests__/` directory, mirroring the source file name

### Test Structure

```typescript
describe('ComponentOrModule', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('describes expected behaviour in plain English', async () => {
    // Arrange
    vi.mocked(fetch).mockResolvedValueOnce({ /* ... */ } as unknown as Response);

    // Act
    const result = await someFunction();

    // Assert
    expect(result).toEqual(expected);
  });
});
```

### What to Test

| Layer | Must Test | Nice to Have |
|-------|-----------|--------------|
| Services | `status()`, `generateConcepts()`, error paths, JSON parsing | All 7 `AIProvider` methods |
| Hooks | State transitions, error capture, reset | Edge cases with concurrent calls |
| Components | Rendering, user interactions, accessibility | Snapshot tests |
| Server | Endpoint responses, validation, error masking | Integration with real Gemini (e2e) |

---

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

### Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |
| `chore` | Build config, dependencies, tooling |
| `style` | Formatting, whitespace (no logic change) |

### Scopes

`app`, `services`, `components`, `hooks`, `server`, `tests`, `docs`

### Examples

```
feat(services): add Anthropic provider implementation
fix(components): prevent double-click on action buttons during loading
refactor(services): extract parseJsonFromText to shared module
test(services): add ollamaService model resolution tests
docs: create ARCHITECTURE.md with system diagrams
```

---

## Pull Request Guidelines

1. **One concern per PR** — don't mix features with refactors
2. **All tests pass** — run `npm run test:run` before pushing
3. **No TypeScript errors** — run `npx tsc --noEmit`
4. **Update documentation** if your change affects:
   - Public API (new provider methods, interface changes)
   - Configuration (new env vars, new settings)
   - Architecture (new services, new components)
5. **Write descriptive PR titles** using commit conventions
6. **Include screenshots** for UI changes

---

## Security Checklist

Before submitting:

- [ ] No API keys or secrets in client-side code
- [ ] No `VITE_*` variables containing secrets
- [ ] User inputs sanitized before inclusion in prompts
- [ ] No `eval()` or `innerHTML` with user data
- [ ] HTTP errors return generic messages (no stack traces to client)
- [ ] CORS origins are explicitly allowlisted
