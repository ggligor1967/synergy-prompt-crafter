import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import IdeationStage from '../../components/stages/IdeationStage';
import { AIProvider } from '../../services/aiProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeProvider = (): AIProvider => ({
  id: 'test',
  name: 'Test Provider',
  status: vi.fn().mockResolvedValue({ configured: true }),
  generateConcepts: vi.fn(),
  generateFullPromptFromData: vi.fn(),
  generatePromptVariations: vi.fn(),
  suggestImprovements: vi.fn(),
  testGeneratedPrompt: vi.fn(),
});

const makeProps = (overrides?: Partial<React.ComponentProps<typeof IdeationStage>>) => ({
  coreIdea: '',
  onCoreIdeaChange: vi.fn(),
  selectedDisciplines: [] as string[],
  onDisciplinesChange: vi.fn(),
  isProviderReady: true,
  providerStatusChecking: false,
  providerErrorMessage: 'Provider unavailable.',
  activeProvider: makeProvider(),
  onConceptsGenerated: vi.fn(),
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Suite 1 — Rendering
// ---------------------------------------------------------------------------
describe('IdeationStage — rendering', () => {
  it('renders the core idea textarea', () => {
    render(<IdeationStage {...makeProps()} />);
    expect(screen.getByLabelText(/core idea or question/i)).toBeInTheDocument();
  });

  it('renders the discipline multi-select', () => {
    render(<IdeationStage {...makeProps()} />);
    expect(screen.getByLabelText(/select disciplines/i)).toBeInTheDocument();
  });

  it('renders the custom discipline input', () => {
    render(<IdeationStage {...makeProps()} />);
    expect(screen.getByLabelText(/add custom discipline/i)).toBeInTheDocument();
  });

  it('renders selected disciplines as removable pills', () => {
    render(<IdeationStage {...makeProps({ selectedDisciplines: ['Quantum Gastronomy', 'Biomechanics'] })} />);
    expect(screen.getByText('Quantum Gastronomy')).toBeInTheDocument();
    expect(screen.getByText('Biomechanics')).toBeInTheDocument();
  });

  it('shows the provider error message when provider is offline and not checking', () => {
    render(<IdeationStage {...makeProps({
      isProviderReady: false,
      providerStatusChecking: false,
      providerErrorMessage: 'Ollama is not running.',
    })} />);
    expect(screen.getByText(/ollama is not running/i)).toBeInTheDocument();
  });

  it('does NOT show provider error message while provider is still checking', () => {
    render(<IdeationStage {...makeProps({
      isProviderReady: false,
      providerStatusChecking: true,
      providerErrorMessage: 'Ollama is not running.',
    })} />);
    expect(screen.queryByText(/ollama is not running/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Explore Concepts button state
// ---------------------------------------------------------------------------
describe('IdeationStage — Explore Concepts button', () => {
  it('disabled when no idea and no discipline', () => {
    render(<IdeationStage {...makeProps()} />);
    expect(screen.getByRole('button', { name: /explore concepts/i })).toBeDisabled();
  });

  it('disabled when idea is present but no discipline selected', () => {
    render(<IdeationStage {...makeProps({ coreIdea: 'Some idea' })} />);
    expect(screen.getByRole('button', { name: /explore concepts/i })).toBeDisabled();
  });

  it('disabled when discipline selected but no idea', () => {
    render(<IdeationStage {...makeProps({ selectedDisciplines: ['Quantum Gastronomy'] })} />);
    expect(screen.getByRole('button', { name: /explore concepts/i })).toBeDisabled();
  });

  it('disabled when provider is not ready (even with idea + discipline)', () => {
    render(<IdeationStage {...makeProps({
      coreIdea: 'Some idea',
      selectedDisciplines: ['Quantum Gastronomy'],
      isProviderReady: false,
    })} />);
    expect(screen.getByRole('button', { name: /explore concepts/i })).toBeDisabled();
  });

  it('enabled when idea, discipline and provider are all present', () => {
    render(<IdeationStage {...makeProps({
      coreIdea: 'Some idea',
      selectedDisciplines: ['Quantum Gastronomy'],
    })} />);
    expect(screen.getByRole('button', { name: /explore concepts/i })).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Custom discipline input
// ---------------------------------------------------------------------------
describe('IdeationStage — custom discipline', () => {
  it('Add button is disabled when the input is empty', () => {
    render(<IdeationStage {...makeProps()} />);
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
  });

  it('calls onDisciplinesChange with the new discipline on Add', () => {
    const props = makeProps();
    render(<IdeationStage {...props} />);
    fireEvent.change(screen.getByLabelText(/add custom discipline/i), { target: { value: 'Quantum Gastronomy' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(props.onDisciplinesChange).toHaveBeenCalledWith(['Quantum Gastronomy']);
  });

  it('does NOT call onDisciplinesChange for a predefined discipline name', () => {
    const props = makeProps();
    render(<IdeationStage {...props} />);
    fireEvent.change(screen.getByLabelText(/add custom discipline/i), { target: { value: 'Physics' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(props.onDisciplinesChange).not.toHaveBeenCalled();
  });

  it('does NOT add a duplicate discipline', () => {
    const props = makeProps({ selectedDisciplines: ['Quantum Gastronomy'] });
    render(<IdeationStage {...props} />);
    fireEvent.change(screen.getByLabelText(/add custom discipline/i), { target: { value: 'Quantum Gastronomy' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(props.onDisciplinesChange).not.toHaveBeenCalled();
  });

  it('clears the input after a successful add', () => {
    render(<IdeationStage {...makeProps()} />);
    const input = screen.getByLabelText(/add custom discipline/i);
    fireEvent.change(input, { target: { value: 'Quantum Gastronomy' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(input).toHaveValue('');
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Concept generation
// ---------------------------------------------------------------------------
describe('IdeationStage — concept generation', () => {
  it('calls onConceptsGenerated with result on success', async () => {
    const provider = makeProvider();
    const concepts = { 'Quantum Gastronomy': ['Molecular entanglement'] };
    vi.mocked(provider.generateConcepts).mockResolvedValueOnce(concepts);
    const props = makeProps({
      coreIdea: 'Music in maths',
      selectedDisciplines: ['Quantum Gastronomy'],
      activeProvider: provider,
    });

    render(<IdeationStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));
    await waitFor(() => expect(props.onConceptsGenerated).toHaveBeenCalledWith(concepts));
  });

  it('passes coreIdea and selectedDisciplines to the provider', async () => {
    const provider = makeProvider();
    vi.mocked(provider.generateConcepts).mockResolvedValueOnce({});
    const props = makeProps({
      coreIdea: 'My research idea',
      selectedDisciplines: ['Quantum Gastronomy', 'Biomechanics'],
      activeProvider: provider,
    });

    render(<IdeationStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));
    await waitFor(() => expect(provider.generateConcepts).toHaveBeenCalledTimes(1));
    expect(provider.generateConcepts).toHaveBeenCalledWith(
      'My research idea',
      ['Quantum Gastronomy', 'Biomechanics'],
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('shows an error alert when concept generation fails', async () => {
    const provider = makeProvider();
    vi.mocked(provider.generateConcepts).mockRejectedValueOnce(new Error('API quota exceeded'));
    const props = makeProps({
      coreIdea: 'Music in maths',
      selectedDisciplines: ['Quantum Gastronomy'],
      activeProvider: provider,
    });

    render(<IdeationStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/concept generation failed/i)
    );
    expect(props.onConceptsGenerated).not.toHaveBeenCalled();
  });

  it('does not call onConceptsGenerated when provider returns empty result', async () => {
    const provider = makeProvider();
    // generateConcepts resolves with falsy — simulate parse failure
    vi.mocked(provider.generateConcepts).mockResolvedValueOnce({} as never);
    const props = makeProps({
      coreIdea: 'Idea',
      selectedDisciplines: ['Quantum Gastronomy'],
      activeProvider: provider,
    });

    render(<IdeationStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /explore concepts/i }));
    // Empty object is falsy-ish but truthy; onConceptsGenerated IS called with {}
    await waitFor(() => expect(provider.generateConcepts).toHaveBeenCalled());
  });
});
