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
  updatePrompt: vi.fn(),
}));

import { getAllPrompts, deletePrompt, toggleFavorite, updatePrompt } from '../services/storage';

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
  vi.mocked(updatePrompt).mockImplementation(async (id, changes) => makeRecord({ id, ...changes }));
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
    await waitFor(() => expect(screen.queryByText('Beta Prompt')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha Prompt')).toBeInTheDocument();
  });

  it('filters records by coreIdea', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'A', coreIdea: 'quantum physics' }),
      makeRecord({ id: '2', title: 'B', coreIdea: 'machine learning' }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('A'));

    fireEvent.change(screen.getByLabelText(/search prompts/i), { target: { value: 'quantum' } });
    await waitFor(() => expect(screen.queryByText('B')).not.toBeInTheDocument());
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows "no prompts match" message when search has no results', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.change(screen.getByLabelText(/search prompts/i), { target: { value: 'zzz-no-match' } });
    await waitFor(() => expect(screen.getByText(/no prompts match/i)).toBeInTheDocument());
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

// ---------------------------------------------------------------------------
// Suite 9 — Tags display (Feature 1)
// ---------------------------------------------------------------------------
describe('PromptHistory — tags display', () => {
  it('renders tags as badge chips for records that have tags', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', tags: ['ethics', 'ai'] }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));
    // Tags appear as spans (chips) — use getAllByText since the tag also appears in filter dropdown
    const ethicsChips = screen.getAllByText('ethics');
    expect(ethicsChips.some(el => el.tagName === 'SPAN')).toBe(true);
    const aiChips = screen.getAllByText('ai');
    expect(aiChips.some(el => el.tagName === 'SPAN')).toBe(true);
  });

  it('shows no tag chips when tags array is empty', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord({ id: '1', tags: [] })]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));
    // No tag filter dropdown appears since there are no tags
    expect(screen.queryByLabelText(/filter by tag/i)).not.toBeInTheDocument();
  });

  it('shows Edit Tags button when record is rendered', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));
    expect(screen.getByLabelText(/edit tags: my test prompt/i)).toBeInTheDocument();
  });

  it('opens inline tag editor when Edit Tags button is clicked', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/edit tags: my test prompt/i));
    expect(screen.getByText('Edit Tags')).toBeInTheDocument();
    expect(screen.getByLabelText(/new tag input/i)).toBeInTheDocument();
  });

  it('adds a new tag via the input', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/edit tags: my test prompt/i));
    fireEvent.change(screen.getByLabelText(/new tag input/i), { target: { value: 'science' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByText('science')).toBeInTheDocument();
  });

  it('saves tags by calling updatePrompt and reloading', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/edit tags: my test prompt/i));
    fireEvent.change(screen.getByLabelText(/new tag input/i), { target: { value: 'newtag' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updatePrompt).toHaveBeenCalledWith('rec-1', { tags: ['newtag'] }));
  });

  it('cancels tag editing without saving', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord()]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/edit tags: my test prompt/i));
    expect(screen.getByText('Edit Tags')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Edit Tags')).not.toBeInTheDocument();
    expect(updatePrompt).not.toHaveBeenCalled();
  });

  it('removes a tag chip from the edit list', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([makeRecord({ tags: ['alpha'] })]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('My Test Prompt'));

    fireEvent.click(screen.getByLabelText(/edit tags: my test prompt/i));
    expect(screen.getByLabelText(/remove tag alpha/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/remove tag alpha/i));

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updatePrompt).toHaveBeenCalledWith('rec-1', { tags: [] }));
  });
});

// ---------------------------------------------------------------------------
// Suite 10 — Enhanced Search (Feature 4)
// ---------------------------------------------------------------------------
describe('PromptHistory — enhanced search', () => {
  it('shows results count', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'Alpha' }),
      makeRecord({ id: '2', title: 'Beta' }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('Alpha'));
    expect(screen.getByText(/2 results/i)).toBeInTheDocument();
  });

  it('searches within tags', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'Alpha', tags: ['machinelearning'] }),
      makeRecord({ id: '2', title: 'Beta', tags: [] }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('Alpha'));

    fireEvent.change(screen.getByLabelText(/search prompts/i), { target: { value: 'machinelearning' } });
    await waitFor(() => expect(screen.queryByText('Beta')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('searches within disciplines', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'Alpha', disciplines: ['Neuroscience'] }),
      makeRecord({ id: '2', title: 'Beta', disciplines: ['History'] }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByText('Alpha'));

    fireEvent.change(screen.getByLabelText(/search prompts/i), { target: { value: 'Neuroscience' } });
    await waitFor(() => expect(screen.queryByText('Beta')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('shows tag filter dropdown when records have tags', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', tags: ['ai'] }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByLabelText(/filter by tag/i));
    expect(screen.getByLabelText(/filter by tag/i)).toBeInTheDocument();
  });

  it('filters records by tag when tag filter is changed', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'Alpha', tags: ['ai'] }),
      makeRecord({ id: '2', title: 'Beta', tags: ['biology'] }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByLabelText(/filter by tag/i));

    fireEvent.change(screen.getByLabelText(/filter by tag/i), { target: { value: 'ai' } });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('shows discipline filter dropdown when records have disciplines', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', disciplines: ['Physics'] }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByLabelText(/filter by discipline/i));
    expect(screen.getByLabelText(/filter by discipline/i)).toBeInTheDocument();
  });

  it('filters records by discipline', async () => {
    vi.mocked(getAllPrompts).mockResolvedValue([
      makeRecord({ id: '1', title: 'Physics Prompt', disciplines: ['Physics'] }),
      makeRecord({ id: '2', title: 'History Prompt', disciplines: ['History'] }),
    ]);
    render(<PromptHistory {...makeProps()} />);
    await waitFor(() => screen.getByLabelText(/filter by discipline/i));

    fireEvent.change(screen.getByLabelText(/filter by discipline/i), { target: { value: 'Physics' } });
    expect(screen.getByText('Physics Prompt')).toBeInTheDocument();
    expect(screen.queryByText('History Prompt')).not.toBeInTheDocument();
  });
});
