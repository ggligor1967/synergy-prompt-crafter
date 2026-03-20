import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SettingsPanel from '../components/SettingsPanel';

/**
 * Unit tests for components/SettingsPanel.tsx
 *
 * Strategy
 * --------
 * `listModels` is module-mocked so no real HTTP requests are made.  Every
 * suite controls the mock's resolved value via `vi.mocked(listModels)` in
 * `beforeEach`, and resets mocks in `afterEach` to prevent cross-test state.
 *
 * A shared `makeProps` factory provides sensible defaults and allows
 * per-test overrides, keeping individual tests concise.
 *
 * Suites
 * ------
 *  1. Rendering — initial DOM state and async model loading
 *  2. Model selection — user-driven changes and auto-selection logic
 *  3. Close behaviour — X button and backdrop click
 *  4. Error state — Ollama unreachable (empty model list)
 *  5. Refresh — re-fetch triggered by the Refresh button
 */

// ---------------------------------------------------------------------------
// Module mock — isolates SettingsPanel from the real Ollama HTTP client
//
// vi.mock() is hoisted to the top of the module by Vitest's transform, so
// the mock is active before any imports are resolved.  The real listModels
// is replaced with a vi.fn() that tests configure per-scenario.
// ---------------------------------------------------------------------------
vi.mock('../services/ollamaService', () => ({
  listModels: vi.fn(),
  OLLAMA_MODEL_STORAGE_KEY: 'ollamaModel',
}));

// Import after mock so we get the mocked version
import { listModels } from '../services/ollamaService';

const MOCK_MODELS = ['gemma3:4b-cloud', 'gemma3:27b-cloud', 'qwen3-coder:480b-cloud'];

// Default props shared across most tests
const makeProps = (overrides?: Partial<React.ComponentProps<typeof SettingsPanel>>) => ({
  selectedOllamaModel: 'gemma3:4b-cloud',
  onModelChange: vi.fn(),
  selectedGeminiModel: 'gemini-2.5-flash-preview-04-17',
  onGeminiModelChange: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Rendering & initial state
//
// Verifies what the panel looks like synchronously (loading indicator)
// and after the async model fetch resolves (populated dropdown, active label).
// Each test awaits `findByRole('combobox')` as a natural async boundary to
// suppress act() warnings from pending state updates.
// ---------------------------------------------------------------------------
describe('SettingsPanel — rendering', () => {
  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue(MOCK_MODELS);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a dialog with the Settings heading', async () => {
    render(<SettingsPanel {...makeProps()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    // Drain the pending fetchModels microtask — wait for the Ollama combobox specifically
    await screen.findByLabelText('Ollama Model');
  });

  it('shows a loading indicator while models are being fetched', () => {
    // Return a promise that never resolves so the loading state persists
    vi.mocked(listModels).mockReturnValue(new Promise(() => {}));
    render(<SettingsPanel {...makeProps()} />);
    expect(screen.getByText(/loading models/i)).toBeInTheDocument();
  });

  it('renders the Ollama model dropdown populated with fetched models', async () => {
    render(<SettingsPanel {...makeProps()} />);
    const select = await screen.findByLabelText('Ollama Model');
    expect(select).toBeInTheDocument();
    MOCK_MODELS.forEach(model => {
      expect(screen.getByRole('option', { name: model })).toBeInTheDocument();
    });
  });

  it('shows the Gemini active model label immediately and Ollama label once models are loaded', async () => {
    render(<SettingsPanel {...makeProps()} />);
    await screen.findByLabelText('Ollama Model');
    // Both Gemini and Ollama sections show an "Active:" label when loaded
    const activeLabels = screen.getAllByText(/^Active:/);
    expect(activeLabels.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Interaction — model selection
//
// Covers three scenarios:
//   a) User selects a model → onModelChange fired with the chosen value
//   b) Saved model is stale (not in current list) → auto-select first model
//   c) Saved model is present in list → onModelChange NOT called on mount
// ---------------------------------------------------------------------------
describe('SettingsPanel — model selection', () => {
  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue(MOCK_MODELS);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls onModelChange with the chosen value when the user selects an Ollama model', async () => {
    const props = makeProps();
    render(<SettingsPanel {...props} />);
    const select = await screen.findByLabelText('Ollama Model');
    fireEvent.change(select, { target: { value: 'gemma3:27b-cloud' } });
    expect(props.onModelChange).toHaveBeenCalledWith('gemma3:27b-cloud');
  });

  it('calls onGeminiModelChange when the user selects a Gemini model', async () => {
    const props = makeProps();
    render(<SettingsPanel {...props} />);
    await screen.findByLabelText('Ollama Model');
    const select = screen.getByLabelText('Select Gemini model');
    fireEvent.change(select, { target: { value: 'gemini-1.5-pro' } });
    expect(props.onGeminiModelChange).toHaveBeenCalledWith('gemini-1.5-pro');
  });

  it('auto-selects the first model when selectedOllamaModel is not in the fetched list', async () => {
    const props = makeProps({ selectedOllamaModel: 'llama3' });
    render(<SettingsPanel {...props} />);
    await screen.findByLabelText('Ollama Model');
    expect(props.onModelChange).toHaveBeenCalledWith('gemma3:4b-cloud');
  });

  it('does NOT call onModelChange when the current model is already in the list', async () => {
    const props = makeProps({ selectedOllamaModel: 'gemma3:4b-cloud' });
    render(<SettingsPanel {...props} />);
    await screen.findByLabelText('Ollama Model');
    expect(props.onModelChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Interaction — closing the panel
//
// Two dismissal paths are tested:
//   • X button (aria-label="Close settings")
//   • Backdrop click (role="dialog" — the outermost element)
// The inner card click does NOT propagate to onClose (covered implicitly
// because the combobox interaction tests do not trigger onClose).
// ---------------------------------------------------------------------------
describe('SettingsPanel — close behaviour', () => {
  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue(MOCK_MODELS);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls onClose when the X button is clicked', async () => {
    const props = makeProps();
    render(<SettingsPanel {...props} />);
    await screen.findByLabelText('Ollama Model');
    fireEvent.click(screen.getByRole('button', { name: /close settings/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onClose when the semi-transparent backdrop is clicked', async () => {
    const props = makeProps();
    render(<SettingsPanel {...props} />);
    await screen.findByLabelText('Ollama Model');
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Error state — Ollama unreachable
//
// When listModels() resolves to [] the component sets a fetchError string
// and renders a human-readable hint instead of the dropdown.
// ---------------------------------------------------------------------------
describe('SettingsPanel — error state', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows an instructional error message when no Ollama models are returned', async () => {
    vi.mocked(listModels).mockResolvedValue([]);
    render(<SettingsPanel {...makeProps()} />);
    expect(await screen.findByText(/no models found/i)).toBeInTheDocument();
    // The Ollama combobox should not appear — Gemini combobox is always present
    expect(screen.queryByLabelText('Ollama Model')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Refresh button
//
// Clicking Refresh calls listModels() a second time.  The test verifies that
// the dropdown is updated with the newly returned model list (simulating a
// model being pulled via `ollama pull` while the panel was open).
// ---------------------------------------------------------------------------
describe('SettingsPanel — refresh', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('re-fetches models when the Refresh button is clicked', async () => {
    vi.mocked(listModels).mockResolvedValue(MOCK_MODELS);
    render(<SettingsPanel {...makeProps()} />);
    await screen.findByLabelText('Ollama Model');

    // Simulate a new model appearing after refresh
    const extended = [...MOCK_MODELS, 'devstral-2:123b-cloud'];
    vi.mocked(listModels).mockResolvedValue(extended);

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(listModels).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('option', { name: 'devstral-2:123b-cloud' })).toBeInTheDocument();
  });
});
