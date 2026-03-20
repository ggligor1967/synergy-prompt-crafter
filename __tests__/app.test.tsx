/**
 * Integration tests for App.tsx
 *
 * Tests the wizard's observable behaviour (stage transitions, error display,
 * suggestion application) using mocked AI providers so no real network calls
 * are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/Toast';
import App from '../App';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('../services/geminiService', () => ({
  GeminiProvider: {
    id: 'gemini',
    name: 'Gemini (Cloud)',
    status: vi.fn().mockResolvedValue({ configured: true }),
    generateConcepts: vi.fn(),
    generateFullPromptFromData: vi.fn(),
    generatePromptVariations: vi.fn(),
    suggestImprovements: vi.fn(),
    testGeneratedPrompt: vi.fn(),
  },
  // P4.2 — new exports required by App.tsx and SettingsPanel
  GEMINI_MODEL_STORAGE_KEY: 'geminiModel',
  GEMINI_MODELS: ['gemini-2.5-flash-preview-04-17'],
  getGeminiModel: vi.fn().mockReturnValue('gemini-2.5-flash-preview-04-17'),
}));

vi.mock('../services/ollamaService', () => ({
  OllamaProvider: {
    id: 'ollama',
    name: 'Ollama (Local)',
    status: vi.fn().mockResolvedValue({ configured: false }),
    generateConcepts: vi.fn(),
    generateFullPromptFromData: vi.fn(),
    generatePromptVariations: vi.fn(),
    suggestImprovements: vi.fn(),
    testGeneratedPrompt: vi.fn(),
  },
  OLLAMA_MODEL_STORAGE_KEY: 'ollamaModel',
  listModels: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const renderApp = () =>
  render(
    <ToastProvider>
      <App />
    </ToastProvider>
  );

const getGeminiProvider = async () => {
  const { GeminiProvider } = await import('../services/geminiService');
  return GeminiProvider;
};

const renderAppAndWaitForProviderChecks = async () => {
  const provider = await getGeminiProvider();
  renderApp();
  await waitFor(() => expect(provider.status).toHaveBeenCalledTimes(1));
};

/**
 * Fills the Ideation form and waits until the "Explore Concepts" button is
 * enabled — which confirms the provider status resolved to 'online'.
 */
// Must not be in PREDEFINED_DISCIPLINES — the custom discipline input rejects predefined entries.
const setupIdeationAndWaitReady = async (discipline = 'Quantum Gastronomy') => {
  renderApp();

  // Fill in the core idea
  fireEvent.change(screen.getByLabelText(/core idea or question/i), {
    target: { value: 'The role of music in mathematics' },
  });

  // Add a discipline via the custom input (avoids multi-select complexity)
  fireEvent.change(screen.getByLabelText(/add custom discipline/i), {
    target: { value: discipline },
  });
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

  // Wait until the button is enabled — proves isProviderReady === true
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /explore concepts/i })).not.toBeDisabled()
  );
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear(); // P4.1 — prevent wizard state from bleeding between tests
  localStorage.setItem('selectedProviderId', 'gemini');
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// Suite 1 — Initial render
// ---------------------------------------------------------------------------
describe('App — initial render', () => {
  it('shows the Core Idea textarea (Ideation stage)', async () => {
    await renderAppAndWaitForProviderChecks();
    expect(screen.getByLabelText(/core idea or question/i)).toBeInTheDocument();
  });

  it('renders all 5 stage names in the progress bar', async () => {
    await renderAppAndWaitForProviderChecks();
    const nav = screen.getByRole('navigation', { name: /progress/i });
    // Each stage name appears twice (sr-only + visible <p>); getAllByText is safe here
    for (const name of ['Ideation', 'Concepts', 'Construct', 'Refine', 'Finalize']) {
      expect(nav).toHaveTextContent(name);
    }
  });

  it('disables "Explore Concepts" when no idea is entered', async () => {
    await renderAppAndWaitForProviderChecks();
    expect(screen.getByRole('button', { name: /explore concepts/i })).toBeDisabled();
  });

  it('disables "Explore Concepts" when idea is filled but no discipline is selected', async () => {
    await renderAppAndWaitForProviderChecks();
    fireEvent.change(screen.getByLabelText(/core idea or question/i), {
      target: { value: 'Impact of AI on education' },
    });
    expect(screen.getByRole('button', { name: /explore concepts/i })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Provider status
// ---------------------------------------------------------------------------
describe('App — provider status', () => {
  it('calls status() on all providers on mount', async () => {
    const provider = await getGeminiProvider();
    renderApp();
    await waitFor(() => expect(provider.status).toHaveBeenCalledTimes(1));
  });

  it('shows a provider notice when the selected provider is offline', async () => {
    const { GeminiProvider } = await import('../services/geminiService');
    vi.mocked(GeminiProvider.status).mockResolvedValueOnce({ configured: false });

    renderApp();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/provider notice/i)
    );
  });

  it('enables "Explore Concepts" once provider is online and form is filled', async () => {
    await setupIdeationAndWaitReady();
    expect(screen.getByRole('button', { name: /explore concepts/i })).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Concept generation (Stage 1 → 2)
// ---------------------------------------------------------------------------
describe('App — concept generation', () => {
  it('advances to Stage 2 and shows concepts after successful generation', async () => {
    const provider = await getGeminiProvider();
    vi.mocked(provider.generateConcepts).mockResolvedValueOnce({
      'Quantum Gastronomy': ['Molecular entanglement', 'Superposition of flavors'],
    });

    await setupIdeationAndWaitReady(); // default 'Quantum Gastronomy' — not in PREDEFINED_DISCIPLINES
    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));

    await waitFor(() =>
      expect(screen.getByText(/ai-suggested concepts/i)).toBeInTheDocument()
    );
    expect(screen.getByText('Molecular entanglement')).toBeInTheDocument();
    expect(screen.getByText('Superposition of flavors')).toBeInTheDocument();
  });

  it('displays an error alert when concept generation fails', async () => {
    const provider = await getGeminiProvider();
    vi.mocked(provider.generateConcepts).mockRejectedValueOnce(
      new Error('API quota exceeded')
    );

    await setupIdeationAndWaitReady(); // default 'Quantum Gastronomy' — not in PREDEFINED_DISCIPLINES

    // Provider is confirmed ready — now trigger and fail
    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/concept generation failed/i);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — applySuggestion
// ---------------------------------------------------------------------------
describe('App — applySuggestion', () => {
  it('replaces the prompt draft when user clicks "Use This Variation"', async () => {
    const provider = await getGeminiProvider();

    vi.mocked(provider.generateConcepts).mockResolvedValueOnce({
      Biomechanics: ['Force distribution', 'Kinematic chains'],
    });
    vi.mocked(provider.generateFullPromptFromData).mockResolvedValueOnce(
      'Original generated prompt text.'
    );
    vi.mocked(provider.generatePromptVariations).mockResolvedValueOnce([
      {
        id: 'var-1',
        type: 'variation' as const,
        promptText: 'Variation A of the prompt.',
      },
    ]);

    await setupIdeationAndWaitReady('Biomechanics');

    // Stage 1 → 2
    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));
    await waitFor(() => expect(screen.getByText(/ai-suggested concepts/i)).toBeInTheDocument());

    // Stage 2 → 3
    fireEvent.click(screen.getByRole('button', { name: /construct prompt/i }));
    await waitFor(() => expect(screen.getByText(/construct your prompt/i)).toBeInTheDocument());

    // Stage 3 → 4: generate full prompt
    fireEvent.click(screen.getByRole('button', { name: /generate & refine/i }));
    await waitFor(() =>
      expect(screen.getByText('Original generated prompt text.')).toBeInTheDocument()
    );

    // Fetch variations
    fireEvent.click(screen.getByRole('button', { name: /generate variations/i }));
    await waitFor(() =>
      expect(screen.getByText('Variation A of the prompt.')).toBeInTheDocument()
    );

    // Apply variation — replaces the prompt draft
    fireEvent.click(screen.getByRole('button', { name: /use this variation/i }));

    await waitFor(() =>
      expect(screen.queryByText('Original generated prompt text.')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Variation A of the prompt.')).toBeInTheDocument();
  });

  it('displays improvement explanation separately from prompt text', async () => {
    const provider = await getGeminiProvider();

    vi.mocked(provider.generateConcepts).mockResolvedValueOnce({
      Physics: ['Quantum foam'],
    });
    vi.mocked(provider.generateFullPromptFromData).mockResolvedValueOnce('Draft prompt.');
    vi.mocked(provider.suggestImprovements).mockResolvedValueOnce([
      {
        id: 'imp-1',
        type: 'improvement' as const,
        promptText: 'Revised: clarified draft prompt.',
        explanation: 'Adding clarity improves comprehension.',
      },
    ]);

    await setupIdeationAndWaitReady('Biomechanics');

    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));
    await waitFor(() => expect(screen.getByText(/ai-suggested concepts/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /construct prompt/i }));
    await waitFor(() => expect(screen.getByText(/construct your prompt/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /generate & refine/i }));
    await waitFor(() => expect(screen.getByText('Draft prompt.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /suggest improvements/i }));

    await waitFor(() =>
      expect(screen.getByText('Adding clarity improves comprehension.')).toBeInTheDocument()
    );
    expect(screen.getByText('Revised: clarified draft prompt.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Reset
// ---------------------------------------------------------------------------
describe('App — resetApp', () => {
  it('clears all state and returns to Ideation stage', async () => {
    const provider = await getGeminiProvider();
    vi.mocked(provider.generateConcepts).mockResolvedValueOnce({
      'Quantum Gastronomy': ['Molecular entanglement in cooking'],
    });
    vi.mocked(provider.generateFullPromptFromData).mockResolvedValueOnce('Draft prompt.');

    await setupIdeationAndWaitReady(); // default 'Quantum Gastronomy' — not in PREDEFINED_DISCIPLINES

    // Advance to Stage 2
    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));
    await waitFor(() => expect(screen.getByText(/ai-suggested concepts/i)).toBeInTheDocument());

    // Advance to Stage 3, generate, reach Stage 4
    fireEvent.click(screen.getByRole('button', { name: /construct prompt/i }));
    await waitFor(() => expect(screen.getByText(/construct your prompt/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /generate & refine/i }));
    await waitFor(() => expect(screen.getByText(/refine your prompt/i)).toBeInTheDocument());

    // Advance to Stage 5
    fireEvent.click(screen.getByRole('button', { name: /finalize prompt/i }));
    await waitFor(() => expect(screen.getByText(/your mastered prompt/i)).toBeInTheDocument());

    // Reset
    fireEvent.click(screen.getByRole('button', { name: /start new prompt/i }));

    // Back at Stage 1 with cleared inputs
    await waitFor(() =>
      expect(screen.getByLabelText(/core idea or question/i)).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/core idea or question/i)).toHaveValue('');
  });
});
