import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '../components/Toast';
import FinalPromptStage from '../components/stages/FinalPromptStage';

// ---------------------------------------------------------------------------
// Mock navigator.clipboard
// ---------------------------------------------------------------------------
const mockClipboard = {
  writeText: vi.fn(),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

// ---------------------------------------------------------------------------
// Mock URL.createObjectURL / revokeObjectURL for export tests
// ---------------------------------------------------------------------------
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockProvider = {
  id: 'gemini',
  name: 'Gemini (Cloud)',
  status: vi.fn().mockResolvedValue({ configured: true }),
  generateConcepts: vi.fn(),
  generateFullPromptFromData: vi.fn(),
  generatePromptVariations: vi.fn(),
  suggestImprovements: vi.fn(),
  testGeneratedPrompt: vi.fn(),
};

const defaultProps = {
  generatedPrompt: 'You are an expert in AI ethics.',
  isProviderReady: true,
  providerStatusChecking: false,
  providerErrorMessage: '',
  activeProvider: mockProvider,
  onCopyToClipboard: vi.fn(),
  onReset: vi.fn(),
  onBack: vi.fn(),
  coreIdea: 'AI ethics in healthcare',
  disciplines: ['Philosophy', 'Artificial Intelligence'],
  promptData: {
    role: 'Researcher',
    context: 'Healthcare sector',
    task: 'Analyze ethical implications',
    keywords: [],
    constraints: '',
    tone: 'Academic',
    format: 'Essay',
    audience: 'Medical professionals',
  },
};

const renderStage = (props = {}) =>
  render(
    <ToastProvider>
      <FinalPromptStage {...defaultProps} {...props} />
    </ToastProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockClipboard.writeText.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Suite 1 — Export button (Feature 2)
// ---------------------------------------------------------------------------
describe('FinalPromptStage — export', () => {
  it('renders an Export button', () => {
    renderStage();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('shows export format dropdown when Export button is clicked', () => {
    renderStage();
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(screen.getByText(/export as \.txt/i)).toBeInTheDocument();
    expect(screen.getByText(/export as \.md/i)).toBeInTheDocument();
    expect(screen.getByText(/export as \.json/i)).toBeInTheDocument();
  });

  it('Export button is disabled when prompt is empty', () => {
    renderStage({ generatedPrompt: '' });
    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();
  });

  it('triggers a download when .txt export is selected', () => {
    renderStage();
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(screen.getByText(/export as \.txt/i));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('triggers a download when .md export is selected', () => {
    renderStage();
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(screen.getByText(/export as \.md/i));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
  });

  it('triggers a download when .json export is selected', () => {
    renderStage();
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    fireEvent.click(screen.getByText(/export as \.json/i));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Share button (Feature 3)
// ---------------------------------------------------------------------------
describe('FinalPromptStage — share', () => {
  it('renders a Share button', () => {
    renderStage();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('Share button is disabled when prompt is empty', () => {
    renderStage({ generatedPrompt: '' });
    expect(screen.getByRole('button', { name: /share/i })).toBeDisabled();
  });

  it('copies a URL to clipboard when Share is clicked', async () => {
    renderStage();
    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    await waitFor(() => expect(mockClipboard.writeText).toHaveBeenCalledTimes(1));
    const copiedUrl = mockClipboard.writeText.mock.calls[0][0] as string;
    expect(copiedUrl).toContain('?share=');
  });

  it('shows "Link copied!" toast on successful share', async () => {
    renderStage();
    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    await waitFor(() =>
      expect(screen.getByText(/link copied!/i)).toBeInTheDocument()
    );
  });

  it('the share URL contains valid base64-encoded JSON with the prompt data', async () => {
    renderStage();
    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    await waitFor(() => expect(mockClipboard.writeText).toHaveBeenCalled());
    const url = mockClipboard.writeText.mock.calls[0][0] as string;
    const encoded = new URL(url).searchParams.get('share')!;
    const decoded = JSON.parse(decodeURIComponent(atob(encoded)));

    expect(decoded.generatedPrompt).toBe('You are an expert in AI ethics.');
    expect(decoded.coreIdea).toBe('AI ethics in healthcare');
    expect(decoded.disciplines).toEqual(['Philosophy', 'Artificial Intelligence']);
  });
});
