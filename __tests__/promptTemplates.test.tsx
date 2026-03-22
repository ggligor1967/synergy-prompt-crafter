import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PromptTemplates from '../components/PromptTemplates';
import { PROMPT_TEMPLATES } from '../constants';

const makeProps = (overrides?: Partial<React.ComponentProps<typeof PromptTemplates>>) => ({
  onApplyTemplate: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Suite 1 — Rendering
// ---------------------------------------------------------------------------
describe('PromptTemplates — rendering', () => {
  it('renders the panel heading', () => {
    render(<PromptTemplates {...makeProps()} />);
    expect(screen.getByText('Prompt Templates')).toBeInTheDocument();
  });

  it('renders all template names', () => {
    render(<PromptTemplates {...makeProps()} />);
    for (const template of PROMPT_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    }
  });

  it('renders a description for each template', () => {
    render(<PromptTemplates {...makeProps()} />);
    for (const template of PROMPT_TEMPLATES) {
      expect(screen.getByText(template.description)).toBeInTheDocument();
    }
  });

  it('renders discipline chips for each template', () => {
    render(<PromptTemplates {...makeProps()} />);
    // Find the first template's disciplines
    const first = PROMPT_TEMPLATES[0];
    for (const discipline of first.disciplines) {
      // Use getAllByText since the same discipline may appear in multiple templates
      const chips = screen.getAllByText(discipline);
      expect(chips.length).toBeGreaterThan(0);
    }
  });

  it('renders a "Use Template" button for each template', () => {
    render(<PromptTemplates {...makeProps()} />);
    const buttons = screen.getAllByRole('button', { name: /use template/i });
    expect(buttons).toHaveLength(PROMPT_TEMPLATES.length);
  });

  it('renders at least 6 templates', () => {
    render(<PromptTemplates {...makeProps()} />);
    const buttons = screen.getAllByRole('button', { name: /use template/i });
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Close
// ---------------------------------------------------------------------------
describe('PromptTemplates — close', () => {
  it('calls onClose when the X button is clicked', () => {
    const props = makeProps();
    render(<PromptTemplates {...props} />);
    fireEvent.click(screen.getByLabelText(/close templates panel/i));
    expect(props.onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Apply template
// ---------------------------------------------------------------------------
describe('PromptTemplates — apply template', () => {
  it('calls onApplyTemplate with the correct template when "Use Template" is clicked', () => {
    const props = makeProps();
    render(<PromptTemplates {...props} />);

    const firstTemplate = PROMPT_TEMPLATES[0];
    fireEvent.click(screen.getByLabelText(`Use template: ${firstTemplate.name}`));
    expect(props.onApplyTemplate).toHaveBeenCalledWith(firstTemplate);
  });

  it('calls onApplyTemplate for each template with the right data', () => {
    const props = makeProps();
    render(<PromptTemplates {...props} />);

    PROMPT_TEMPLATES.forEach((template, i) => {
      const buttons = screen.getAllByRole('button', { name: /use template/i });
      fireEvent.click(buttons[i]);
      expect(props.onApplyTemplate).toHaveBeenNthCalledWith(i + 1, template);
    });
  });
});
