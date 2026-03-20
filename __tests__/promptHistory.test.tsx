import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PromptHistory from '../components/PromptHistory';
import { PromptRecord } from '../services/storage';

// ---------------------------------------------------------------------------
// Mock the storage service
// ---------------------------------------------------------------------------
vi.mock('../services/storage', () => ({
  getAllPrompts: vi.fn(),
  deletePrompt: vi.fn(),
  toggleFavorite: vi.fn(),
}));

import { getAllPrompts, deletePrompt, toggleFavorite } from '../services/storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeRecord = (overrides?: Partial<PromptRecord>): PromptRecord => ({
  id: 'rec-1',
  title: 'My Test Prompt',
  coreIdea: 'AI ethics',
  promptData: { role: '', context: '', task: '', keywords: [], constraints: '', tone: '', format: '', audience: '' },
  generatedPrompt: 'You are...',
  disciplines: ['Philosophy'],
  tags: [],
  isFavorite: false,
  createdAt: new Date('2026-01-15').getTime(),
  updatedAt: new Date('2026-01-15').getTime(),
  ...overrides,
});

const makeProps = (overrides?: Partial<React.ComponentProps<typeof PromptHistory>>) => ({
  onRestore: vi.fn(),
  onClose: vi.fn(),
  refreshTrigger: 0,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAllPrompts).mockResolvedValue([]);
  vi.mocked(deletePrompt).mockResolvedValue(undefined);
  vi.mocked(toggleFavorite).mockImplementation(async (id) => makeRecord({ id, isFavorite: true }));
});

// ---------------------------------------------------------------------------
// Suite 1 — Rendering
// ---------------------------------------------------------------------------
describe('PromptHistory — rendering', () => {
  it('renders the panel heading', async () => {
    render(<PromptHistory {...makeProps()} />);
    expect(screen.getByText('Prompt History')).toBeInTheDocument();
  });

  it('shows empty state when there are no records', async () => {
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => expect(screen.getByText(/no saved prompts yet/i)).toBeInTheDocument());
  });

  it('renders a record with title and coreIdea', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => expect(screen.getByText('My Test Prompt')).toBeInTheDocument());
    expect(screen.getByText('AI ethics')).toBeInTheDocument();
  });

  it('renders multiple records', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'First' }),
      makeRecord({ id: '2', title: 'Second' }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument());
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders search input and favorites checkbox', async () => {
    render(<PromptHistory {...makeProps()} />);
    expect(screen.getByLabelText(/search prompts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/favorites only/i)).toBeInTheDocument();
  });

  it('renders action buttons for each record', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));
    expect(screen.getByLabelText(/restore prompt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/delete prompt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/add to favorites/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Close
// ---------------------------------------------------------------------------
describe('PromptHistory — close', () => {
  it('calls onClose when the X button is clicked', async () => {
    const props = makeProps();
    render(<PromptHistory {...props} />);
    fireEvent.click(screen.getByLabelText(/close history panel/i));
    expect(props.onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Search filtering
// ---------------------------------------------------------------------------
describe('PromptHistory — search', () => {
  it('filters records by title', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'Alpha Prompt' }),
      makeRecord({ id: '2', title: 'Beta Prompt' }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('Alpha Prompt'));

    fireEvent.change(screen.getByLabelText(/search prompts/i), { target: { value: 'alpha' } });
    expect(screen.getByText('Alpha Prompt')).toBeInTheDocument();
    expect(screen.queryByText('Beta Prompt')).not.toBeInTheDocument();
  });

  it('filters records by coreIdea', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'A', coreIdea: 'quantum physics' }),
      makeRecord({ id: '2', title: 'B', coreIdea: 'machine learning' }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('A'));

    fireEvent.change(screen.getByLabelText(/search prompts/i), { target: { value: 'quantum' } });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });

  it('shows "no prompts match" message when search has no results', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.change(screen.getByLabelText(/search prompts/i), { target: { value: 'zzz-no-match' } });
    expect(screen.getByText(/no prompts match/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Favorites filter
// ---------------------------------------------------------------------------
describe('PromptHistory — favorites filter', () => {
  it('shows only favorites when checkbox is checked', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'Fav', isFavorite: true }),
      makeRecord({ id: '2', title: 'Not Fav', isFavorite: false }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('Fav'));

    fireEvent.click(screen.getByLabelText(/favorites only/i));
    expect(screen.getByText('Fav')).toBeInTheDocument();
    expect(screen.queryByText('Not Fav')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Restore
// ---------------------------------------------------------------------------
describe('PromptHistory — restore', () => {
  it('calls onRestore with the record when restore button is clicked', async () => {
    const record = makeRecord();
    vi.mocked(getAllPrompts).mockResolvedValue([record]);
    const props = makeProps();
    render(<PromptHistory {...props} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/restore prompt/i));
    expect(props.onRestore).toHaveBeenCalledWith(record);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Delete with confirmation
// ---------------------------------------------------------------------------
describe('PromptHistory — delete', () => {
  it('shows confirmation UI when delete button is clicked', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/delete prompt/i));
    expect(screen.getByText(/delete this prompt\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('calls deletePrompt and reloads list on confirm', async () => {
    const record = makeRecord();
    vi.mocked(getAllPrompts).mockResolvedValue([record]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/delete prompt/i));
    vi.mocked(getAllPrompts).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(deletePrompt).toHaveBeenCalledWith(record.id));
    await waitFor(() => expect(screen.getByText(/no saved prompts yet/i)).toBeInTheDocument());
  });

  it('hides confirmation when Cancel is clicked', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/delete prompt/i));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByText(/delete this prompt\?/i)).not.toBeInTheDocument();
    expect(deletePrompt).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Toggle favorite
// ---------------------------------------------------------------------------
describe('PromptHistory — toggle favorite', () => {
  it('calls toggleFavorite when star button is clicked', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/add to favorites/i));
    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith('rec-1'));
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — refreshTrigger
// ---------------------------------------------------------------------------
describe('PromptHistory — refreshTrigger', () => {
  it('reloads when refreshTrigger changes', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([]);
    const { rerender } = render(<PromptHistory {...makeProps({ refreshTrigger: 0 })} />);
    await waitFor(() => expect(getAllPrompts).toHaveBeenCalledTimes(1));

    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    rerender(<PromptHistory {...makeProps({ refreshTrigger: 1 })} />);
    await waitFor(() => expect(getAllPrompts).toHaveBeenCalledTimes(2));
    expect(screen.getByText('My Test Prompt')).toBeInTheDocument();
  });
});
