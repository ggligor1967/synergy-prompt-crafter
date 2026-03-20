import React from 'react';
import { PromptTemplate } from '../types';
import { PROMPT_TEMPLATES } from '../constants';
import { DocumentTextIcon } from './Icons';

interface PromptTemplatesProps {
  onApplyTemplate: (template: PromptTemplate) => void;
  onClose: () => void;
}

const XIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PromptTemplates: React.FC<PromptTemplatesProps> = ({ onApplyTemplate, onClose }) => {
  return (
    <div
      className="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col z-50"
      role="complementary"
      aria-label="Prompt templates"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="w-5 h-5 text-sky-400" />
          <h2 className="text-base font-semibold text-sky-400">Prompt Templates</h2>
        </div>
        <button onClick={onClose} aria-label="Close templates panel" className="text-slate-400 hover:text-slate-100 transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-700">
        Select a template to pre-fill the wizard with a starting point.
      </p>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <ul className="divide-y divide-slate-800">
          {PROMPT_TEMPLATES.map(template => (
            <li key={template.name} className="px-4 py-4 hover:bg-slate-800/50 transition-colors">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100">{template.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.disciplines.map(d => (
                      <span
                        key={d}
                        className="inline-block px-1.5 py-0.5 bg-sky-900 text-sky-300 rounded text-xs"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onApplyTemplate(template)}
                aria-label={`Use template: ${template.name}`}
                className="mt-3 w-full px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded text-xs font-medium transition-colors"
              >
                Use Template
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default PromptTemplates;
