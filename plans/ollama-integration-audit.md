# Ollama Integration Plan - Audit Report

**Date:** 2026-03-20  
**Auditor:** Code Mode  
**Plan Audited:** `plans/ollama-integration-plan.md`  
**Reference Documents:** `plans/implementation-plan.md`, `plans/comprehensive-analysis.md`

---

## Executive Summary

The Ollama integration plan demonstrates **strong architectural alignment** with the existing codebase but contains several **critical gaps** that must be addressed before implementation. The plan correctly identifies the service layer abstraction as the integration point but lacks detailed handling of:

1. **JSON parsing compatibility** - Ollama's response format differs from Gemini
2. **Error handling consistency** - Missing unified error mapping
3. **State management** - No strategy for provider-specific state
4. **Testing strategy** - Insufficient test coverage details
5. **Backward compatibility** - No migration path for existing users

**Overall Assessment:** 🟡 **Needs Revision Before Implementation**

---

## 1. Architectural Coherence Audit

### 1.1 Strengths

| Aspect | Status | Evidence |
|--------|--------|----------|
| **Service Layer Abstraction** | ✅ Excellent | Correctly identifies `geminiService.ts` as integration point |
| **Provider Interface Design** | ✅ Good | `AIProvider` interface covers all required methods |
| **Type Safety** | ✅ Good | Uses existing TypeScript types (`AiConcepts`, `PromptData`) |
| **Environment Configuration** | ✅ Good | Leverages Vite's `import.meta.env` pattern |

### 1.2 Architectural Gaps

#### Gap 1: Missing `parseJsonFromText` Reuse Strategy

**Issue:** The plan mentions "Reuse parseJsonFromText from geminiService.ts" but doesn't address that this function is defined inside `geminiService.ts` (not exported).

**Location:** [`services/geminiService.ts:30`](services/geminiService.ts:30)

**Risk:** High - Implementation will fail without proper module structure

**Recommendation:**
```typescript
// services/jsonParser.ts (NEW - Extract to shared module)
export const parseJsonFromText = <T,>(text: string): T | null => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Failed to parse JSON response:", e, "Raw text:", text);
    try {
      return JSON.parse(text.trim()) as T;
    } catch (e2) {
      console.error("Failed to parse JSON response (fallback):", e2, "Raw text:", text);
      return null;
    }
  }
};
```

#### Gap 2: Ollama API Response Format Mismatch

**Issue:** Ollama's `/api/generate` endpoint returns `{ response: string }` but the plan doesn't handle streaming responses or full response objects.

**Location:** [`plans/ollama-integration-plan.md:126-148`](plans/ollama-integration-plan.md:126)

**Risk:** High - JSON parsing will fail on Ollama responses

**Current Plan Code:**
```typescript
const response = await fetch(url, {
  model, prompt, stream: false, options
});
const data = await response.json();
return data.response as string;  // ❌ Missing stream handling
```

**Required Fix:**
```typescript
const makeOllamaRequest = async (prompt: string, options: Record<string, unknown> = {}): Promise<string> => {
  const url = `${getOllamaUrl()}/api/generate`;
  const model = getModel();
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Handle both streaming and non-streaming responses
  if (data.response) {
    return data.response;
  }
  
  // Handle full response with context
  if (data.response && data.context) {
    return data.response;
  }
  
  throw new Error('Unexpected Ollama response format');
};
```

#### Gap 3: No Provider Selection Persistence

**Issue:** The plan doesn't address how provider selection should persist across sessions.

**Location:** [`plans/ollama-integration-plan.md:249-271`](plans/ollama-integration-plan.md:249)

**Risk:** Medium - Poor UX (user must re-select provider on each reload)

**Recommendation:**
```typescript
// In App.tsx
const [selectedProvider, setSelectedProvider] = useState<string>(() => {
  const saved = localStorage.getItem('selectedProvider');
  return saved || 'gemini';
});

useEffect(() => {
  localStorage.setItem('selectedProvider', selectedProvider);
}, [selectedProvider]);
```

---

## 2. Technical Completeness Audit

### 2.1 Missing Implementation Details

#### Missing Detail 1: Ollama Model Loading Check

**Issue:** The plan doesn't verify if the requested model exists before making API calls.

**Risk:** High - Users get cryptic errors when model doesn't exist

**Recommendation:**
```typescript
// Add to ollamaService.ts
const ensureModelExists = async (model: string): Promise<void> => {
  try {
    const response = await fetch(`${getOllamaUrl()}/api/tags`);
    if (!response.ok) {
      throw new Error('Cannot fetch model list');
    }
    const data = await response.json();
    const models = (data.models || []) as Array<{ name: string }>;
    
    if (!models.some(m => m.name === model)) {
      throw new Error(`Model "${model}" not found. Run: ollama pull ${model}`);
    }
  } catch (error) {
    console.warn('Could not verify model existence:', error);
    // Don't block - model might exist but API unavailable
  }
};
```

#### Missing Detail 2: Request Cancellation Support

**Issue:** The comprehensive analysis identified missing `AbortController` support as a medium-severity issue, but the Ollama plan doesn't address this.

**Risk:** Medium - Race conditions when user navigates between stages

**Recommendation:**
```typescript
// Update AIProvider interface
export interface AIProvider {
  // ... existing methods
  generateConcepts: (
    idea: string, 
    disciplines: string[], 
    signal?: AbortSignal  // Add abort signal
  ) => Promise<AiConcepts>;
}

// In ollamaService.ts
generateConcepts: async (idea: string, disciplines: string[], signal?: AbortSignal): Promise<AiConcepts> => {
  // ... setup
  const response = await fetch(url, {
    // ... other options
    signal,  // Pass abort signal
  });
  // ...
}
```

#### Missing Detail 3: Rate Limiting Strategy

**Issue:** The comprehensive analysis identified missing rate limiting as a medium-severity issue.

**Risk:** Medium - Users can spam requests and overwhelm local resources

**Recommendation:**
```typescript
// hooks/useRateLimiter.ts (NEW)
export const useRateLimiter = (maxRequests: number = 3, windowMs: number = 1000) => {
  const [pendingRequests, setPendingRequests] = useState(0);
  
  const canMakeRequest = pendingRequests < maxRequests;
  
  const executeWithRateLimit = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    if (!canMakeRequest) {
      throw new Error('Rate limit exceeded. Please wait before making another request.');
    }
    
    setPendingRequests(prev => prev + 1);
    try {
      return await fn();
    } finally {
      setPendingRequests(prev => prev - 1);
    }
  }, [canMakeRequest]);
  
  return { executeWithRateLimit, canMakeRequest, pendingRequests };
};
```

### 2.2 Incomplete Method Implementations

#### Incomplete Method: `generateFullPrompt`

**Issue:** The plan shows `// ... other methods following same pattern` but doesn't provide complete implementation.

**Risk:** Medium - Inconsistent behavior between providers

**Required Implementation:**
```typescript
generateFullPrompt: async (
  data: PromptData, 
  disciplines: string[], 
  idea: string,
  signal?: AbortSignal
): Promise<string> => {
  const promptStructure = `
    Core Idea: ${idea.replace(/[<>]/g, '').trim() || "N/A"}
    Disciplines: ${disciplines.map(d => d.replace(/[<>]/g, '').trim()).join(', ')}
    Role: ${(data.role || "An expert synthesizing knowledge from multiple fields.").replace(/[<>]/g, '').trim()}
    Context: ${(data.context || "").replace(/[<>]/g, '').trim()}
    Task: ${(data.task || "").replace(/[<>]/g, '').trim()}
    Keywords: ${(data.keywords || []).map(k => k.replace(/[<>]/g, '').trim()).join(', ') || "N/A"}
    Audience: ${(data.audience || "General").replace(/[<>]/g, '').trim()}
    Tone: ${(data.tone || "Neutral").replace(/[<>]/g, '').trim()}
    Format: ${(data.format || "Detailed text").replace(/[<>]/g, '').trim()}
    Additional Constraints/Details: ${(data.constraints || "N/A").replace(/[<>]/g, '').trim()}
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
    const responseText = await makeOllamaRequest(instruction, { temperature: 0.7 }, signal);
    return responseText.trim();
  } catch (error) {
    console.error("Error generating full prompt from data:", error);
    throw new Error(`Failed to generate full prompt: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

---

## 3. Conformance with Existing Plans

### 3.1 Alignment with Implementation Plan

| Requirement | Implementation Plan | Ollama Plan | Status |
|-------------|---------------------|-------------|--------|
| **Server-Side Proxy** | ✅ Required for Gemini | ❌ Not addressed | ⚠️ Conflict |
| **Environment Variables** | ✅ `VITE_API_BASE_URL` | ✅ `VITE_OLLAMA_URL` | ✅ Consistent |
| **Input Sanitization** | ✅ Required | ⚠️ Partial (only in examples) | ⚠️ Incomplete |
| **Error Handling** | ✅ User-friendly messages | ⚠️ Raw errors in examples | ⚠️ Incomplete |
| **JSON Parsing** | ✅ `parseJsonFromText` | ⚠️ References but no implementation | ⚠️ Incomplete |

**Conflict Identified:** The implementation plan requires a server-side proxy for Gemini to hide API keys. The Ollama plan uses direct client-side API calls. This creates two different architectural patterns.

**Resolution Strategy:**
```typescript
// Option A: Keep Ollama client-side (recommended for local inference)
// - Ollama runs locally, no API key exposure
// - Gemini uses server proxy

// Option B: Create unified proxy for both
// - /api/gemini/* routes to Gemini API
// - /api/ollama/* routes to local Ollama
// - More complex but consistent architecture
```

### 3.2 Alignment with Comprehensive Analysis

| Finding | Ollama Plan Addressed? | Notes |
|---------|------------------------|-------|
| **API Key Exposure** | ✅ Addressed | Ollama has no API key |
| **Input Sanitization** | ⚠️ Partial | Only shown in examples |
| **Error Messages** | ⚠️ Partial | Examples show raw errors |
| **Rate Limiting** | ❌ Not addressed | Critical gap |
| **Request Cancellation** | ❌ Not addressed | Medium severity issue |
| **State Management** | ⚠️ Partial | Basic state shown, no persistence |
| **Testing** | ⚠️ Minimal | Only basic test structure shown |

---

## 4. Risk Assessment

### 4.1 Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **JSON Parsing Failure** | High | High | Extract `parseJsonFromText` to shared module, add comprehensive tests |
| **Ollama API Format Mismatch** | Medium | High | Add response format validation, handle streaming |
| **Model Not Found Errors** | High | Medium | Add model existence check before API calls |
| **Race Conditions** | Medium | Medium | Implement `AbortController` support |

### 4.2 High Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Rate Limiting Missing** | High | Medium | Implement rate limiter hook |
| **Provider Selection Not Persisted** | High | Low | Add localStorage persistence |
| **No Model Download UI** | Medium | Medium | Add model management UI |

### 4.3 Medium Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Architecture Inconsistency** | Medium | Medium | Choose one pattern (client-side or proxy) |
| **Test Coverage Insufficient** | Medium | Medium | Add comprehensive unit tests |
| **Error Messages Not User-Friendly** | Medium | Medium | Map all errors to user-friendly messages |

---

## 5. Gap Analysis Summary

### 5.1 Code Gaps

| File | Gap | Severity |
|------|-----|----------|
| `services/jsonParser.ts` | Missing - needs extraction | High |
| `services/ollamaService.ts` | Incomplete - missing model check | High |
| `services/ollamaService.ts` | Incomplete - missing abort signal | Medium |
| `hooks/useRateLimiter.ts` | Missing - needs implementation | Medium |
| `hooks/useProviderState.ts` | Missing - needs persistence | Low |

### 5.2 Documentation Gaps

| Document | Gap | Severity |
|----------|-----|----------|
| `ollama-integration-plan.md` | Missing detailed implementation examples | High |
| `ollama-integration-plan.md` | Missing error handling strategy | Medium |
| `ollama-integration-plan.md` | Missing testing strategy | Medium |

---

## 6. Recommendations

### 6.1 Pre-Implementation Checklist

Before starting implementation, complete these tasks:

- [ ] **Extract `parseJsonFromText`** to `services/jsonParser.ts`
- [ ] **Add model existence check** to Ollama service
- [ ] **Implement rate limiter hook** (`useRateLimiter`)
- [ ] **Add abort signal support** to `AIProvider` interface
- [ ] **Define error mapping strategy** for user-friendly messages
- [ ] **Choose architecture pattern** (client-side vs proxy)
- [ ] **Create test strategy** with coverage targets

### 6.2 Implementation Priority

**Phase 1: Foundation (Critical)**
1. Extract `parseJsonFromText` to shared module
2. Create `useRateLimiter` hook
3. Implement basic Ollama service with model check

**Phase 2: Integration (High)**
4. Add abort signal support
5. Implement error mapping
6. Create provider selection UI

**Phase 3: Polish (Medium)**
7. Add provider settings persistence
8. Implement model library UI
9. Add comprehensive tests

### 6.3 Testing Requirements

```typescript
// Test coverage targets:
// - parseJsonFromText: 100% (pure function)
// - ollamaService: 90% (all methods)
// - ProviderSelector: 100% (UI component)
// - App.tsx integration: 80% (critical paths)

// Test files needed:
// __tests__/jsonParser.test.ts
// __tests__/ollamaService.test.ts
// __tests__/ProviderSelector.test.tsx
// __tests__/App.integration.test.tsx
```

---

## 7. Conclusion

The Ollama integration plan is **architecturally sound** but requires significant refinement before implementation. The plan correctly identifies the integration points but lacks:

1. **Detailed implementation guidance** for critical methods
2. **Error handling strategy** for user-friendly messages
3. **Testing strategy** with coverage targets
4. **Architecture consistency** with existing implementation plan

**Recommendation:** **DO NOT PROCEED WITH IMPLEMENTATION** until the gaps identified in this audit are addressed. The plan should be revised to include:

1. Extracted `parseJsonFromText` module
2. Complete method implementations with error handling
3. Rate limiting and request cancellation
4. Comprehensive testing strategy
5. Clear architecture decision (client-side vs proxy)

**Estimated Additional Planning Time:** 4-6 hours

---

*Audit completed on 2026-03-20 by Code Mode*
