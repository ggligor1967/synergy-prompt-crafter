import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AIRefinementStage from '../../components/stages/AIRefinementStage';
import { AIProvider } from '../../services/aiProvider';
import { RefinementSuggestion } from '../../types';

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

const makeProps = (overrides?: Partial<React.ComponentProps<typeof AIRefinementStage>>) => ({
  generatedPrompt: '',
  refinementSuggestions: [] as RefinementSuggestion[],
  onSuggestionsChange: vi.fn(),
  onApplySuggestion: vi.fn(),
  isProviderReady: true,
  providerStatusChecking: false,
  providerErrorMessage: 'Provider unavailable.',
  activeProvider: makeProvider(),
  onNext: vi.fn(),
  onBack: vi.fn(),
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Suite 1 — Rendering
// ---------------------------------------------------------------------------
describe('AIRefinementStage — rendering', () => {
  it('displays the current prompt draft', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: 'My generated prompt.' })} />);
    expect(screen.getByText('My generated prompt.')).toBeInTheDocument();
  });

  it('shows placeholder text when prompt is empty', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: '' })} />);
    expect(screen.getByText(/prompt not generated yet/i)).toBeInTheDocument();
  });

  it('renders Generate Variations and Suggest Improvements buttons', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: 'X' })} />);
    expect(screen.getByRole('button', { name: /generate variations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /suggest improvements/i })).toBeInTheDocument();
  });

  it('renders Back and Finalize Prompt navigation buttons', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: 'X' })} />);
    expect(screen.getByRole('button', { name: /back to construction/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finalize prompt/i })).toBeInTheDocument();
  });

  it('renders suggestion pills with promptText and explanation', () => {
    const suggestions: RefinementSuggestion[] = [
      { id: 'v1', type: 'variation', promptText: 'Variation A text.' },
      { id: 'i1', type: 'improvement', promptText: 'Improved text.', explanation: 'Adding clarity helps.' },
    ];
    render(<AIRefinementStage {...makeProps({ generatedPrompt: 'X', refinementSuggestions: suggestions })} />);
    expect(screen.getByText('Variation A text.')).toBeInTheDocument();
    expect(screen.getByText('Improved text.')).toBeInTheDocument();
    expect(screen.getByText('Adding clarity helps.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Button disabled states
// ---------------------------------------------------------------------------
describe('AIRefinementStage — disabled states', () => {
  it('Generate Variations disabled when no prompt', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: '' })} />);
    expect(screen.getByRole('button', { name: /generate variations/i })).toBeDisabled();
  });

  it('Suggest Improvements disabled when no prompt', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: '' })} />);
    expect(screen.getByRole('button', { name: /suggest improvements/i })).toBeDisabled();
  });

  it('Generate Variations disabled when provider not ready', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: 'X', isProviderReady: false })} />);
    expect(screen.getByRole('button', { name: /generate variations/i })).toBeDisabled();
  });

  it('Finalize Prompt disabled when no prompt', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: '' })} />);
    expect(screen.getByRole('button', { name: /finalize prompt/i })).toBeDisabled();
  });

  it('Finalize Prompt enabled when prompt present', () => {
    render(<AIRefinementStage {...makeProps({ generatedPrompt: 'X' })} />);
    expect(screen.getByRole('button', { name: /finalize prompt/i })).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Variation generation
// ---------------------------------------------------------------------------
describe('AIRefinementStage — variations', () => {
  it('calls onSuggestionsChange with variations on success', async () => {
    const provider = makeProvider();
    const variations: RefinementSuggestion[] = [
      { id: 'v1', type: 'variation', promptText: 'Variation A.' },
    ];
    vi.mocked(provider.generatePromptVariations).mockResolvedValueOnce(variations);
    const props = makeProps({ generatedPrompt: 'Original.', activeProvider: provider });

    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /generate variations/i }));
    await waitFor(() => expect(props.onSuggestionsChange).toHaveBeenCalledWith(variations));
  });

  it('preserves existing improvements when adding variations', async () => {
    const provider = makeProvider();
    const existingImprovement: RefinementSuggestion = { id: 'i1', type: 'improvement', promptText: 'Better.' };
    const newVariation: RefinementSuggestion = { id: 'v1', type: 'variation', promptText: 'Variant.' };
    vi.mocked(provider.generatePromptVariations).mockResolvedValueOnce([newVariation]);

    const props = makeProps({
      generatedPrompt: 'Original.',
      refinementSuggestions: [existingImprovement],
      activeProvider: provider,
    });

    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /generate variations/i }));
    await waitFor(() =>
      expect(props.onSuggestionsChange).toHaveBeenCalledWith([existingImprovement, newVariation])
    );
  });

  it('shows an error alert when variation generation fails', async () => {
    const provider = makeProvider();
    vi.mocked(provider.generatePromptVariations).mockRejectedValueOnce(new Error('Rate limited'));
    const props = makeProps({ generatedPrompt: 'Original.', activeProvider: provider });

    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /generate variations/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/variation generation failed/i)
    );
    expect(props.onSuggestionsChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Improvement suggestions
// ---------------------------------------------------------------------------
describe('AIRefinementStage — improvements', () => {
  it('calls onSuggestionsChange with improvements on success', async () => {
    const provider = makeProvider();
    const improvements: RefinementSuggestion[] = [
      { id: 'i1', type: 'improvement', promptText: 'Revised.', explanation: 'Clearer.' },
    ];
    vi.mocked(provider.suggestImprovements).mockResolvedValueOnce(improvements);
    const props = makeProps({ generatedPrompt: 'Draft.', activeProvider: provider });

    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /suggest improvements/i }));
    await waitFor(() => expect(props.onSuggestionsChange).toHaveBeenCalledWith(improvements));
  });

  it('shows an error alert when improvement suggestions fail', async () => {
    const provider = makeProvider();
    vi.mocked(provider.suggestImprovements).mockRejectedValueOnce(new Error('Timeout'));
    const props = makeProps({ generatedPrompt: 'Draft.', activeProvider: provider });

    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /suggest improvements/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/improvement suggestions failed/i)
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Apply suggestion
// ---------------------------------------------------------------------------
describe('AIRefinementStage — apply suggestion', () => {
  it('calls onApplySuggestion with the suggestion when "Use This Variation" is clicked', () => {
    const suggestion: RefinementSuggestion = { id: 'v1', type: 'variation', promptText: 'Variation A.' };
    const props = makeProps({ generatedPrompt: 'X', refinementSuggestions: [suggestion] });
    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /use this variation/i }));
    expect(props.onApplySuggestion).toHaveBeenCalledWith(suggestion);
  });

  it('calls onApplySuggestion with the improvement when "Use This Improvement" is clicked', () => {
    const suggestion: RefinementSuggestion = { id: 'i1', type: 'improvement', promptText: 'Better.', explanation: 'Why.' };
    const props = makeProps({ generatedPrompt: 'X', refinementSuggestions: [suggestion] });
    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /use this improvement/i }));
    expect(props.onApplySuggestion).toHaveBeenCalledWith(suggestion);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Navigation
// ---------------------------------------------------------------------------
describe('AIRefinementStage — navigation', () => {
  it('calls onBack when the Back button is clicked', () => {
    const props = makeProps({ generatedPrompt: 'X' });
    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /back to construction/i }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('calls onNext when the Finalize Prompt button is clicked', () => {
    const props = makeProps({ generatedPrompt: 'X' });
    render(<AIRefinementStage {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /finalize prompt/i }));
    expect(props.onNext).toHaveBeenCalled();
  });
});
