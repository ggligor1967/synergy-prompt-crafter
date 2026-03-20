import React, { useCallback } from 'react';
import { PromptData } from '../../types';
import { PROMPT_TONES, PROMPT_FORMATS } from '../../constants';
import { AIProvider } from '../../services/aiProvider';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import ActionButton from '../ActionButton';
import Pill from '../Pill';
import LoadingSpinner from '../LoadingSpinner';
import { ArrowLeftIcon, ArrowRightIcon } from '../Icons';

interface PromptConstructionStageProps {
  promptData: PromptData;
  onPromptDataChange: (field: keyof PromptData, value: string | string[]) => void;
  onRemoveKeyword: (k: string) => void;
  isProviderReady: boolean;
  providerStatusChecking: boolean;
  providerErrorMessage: string;
  activeProvider: AIProvider;
  selectedDisciplines: string[];
  coreIdea: string;
  onPromptGenerated: (prompt: string) => void;
  onBack: () => void;
}

const PromptConstructionStage: React.FC<PromptConstructionStageProps> = ({
  promptData, onPromptDataChange, onRemoveKeyword,
  isProviderReady, providerStatusChecking, providerErrorMessage,
  activeProvider, selectedDisciplines, coreIdea,
  onPromptGenerated, onBack,
}) => {
  const generateFn = useCallback(
    () => activeProvider.generateFullPromptFromData(promptData, selectedDisciplines, coreIdea),
    [activeProvider, promptData, selectedDisciplines, coreIdea]
  );
  const fullPromptOp = useAsyncOperation(generateFn);

  const handleGenerate = async () => {
    try {
      const prompt = await fullPromptOp.execute();
      if (prompt) onPromptGenerated(prompt);
    } catch { /* captured in fullPromptOp.error */ }
  };

  const fields: { key: keyof PromptData; label: string; type: 'text' | 'textarea' | 'select'; options?: string[]; accessibleName?: string }[] = [
    { key: 'role', label: 'AI Role', type: 'text', accessibleName: 'AI Role for the prompt' },
    { key: 'context', label: 'Context / Background', type: 'textarea', accessibleName: 'Context or background for the prompt' },
    { key: 'task', label: 'Core Task / Question', type: 'textarea', accessibleName: 'Core task or question for the AI' },
    { key: 'audience', label: 'Target Audience', type: 'text', accessibleName: 'Target audience for the AI response' },
    { key: 'tone', label: 'Desired Tone', type: 'select', options: PROMPT_TONES, accessibleName: 'Desired tone for the AI response' },
    { key: 'format', label: 'Output Format', type: 'select', options: PROMPT_FORMATS, accessibleName: 'Desired output format from the AI' },
    { key: 'constraints', label: 'Additional Constraints / Details', type: 'textarea', accessibleName: 'Additional constraints or details for the prompt' },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-sky-400">Construct Your Prompt</h3>
      {fullPromptOp.error && (
        <div className="p-3 bg-red-800/50 border border-red-700 text-red-300 rounded-md text-sm" role="alert">
          <p className="font-semibold">Prompt construction failed:</p>
          <p>{fullPromptOp.error}</p>
        </div>
      )}
      {fullPromptOp.isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="w-12 h-12" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[65vh] overflow-y-auto custom-scrollbar pr-2">
          {fields.map(f => (
            <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
              <label htmlFor={f.key} className="block text-sm font-medium text-slate-300 mb-1">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea id={f.key} value={promptData[f.key] as string} onChange={e => onPromptDataChange(f.key, e.target.value)} rows={3} className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 custom-scrollbar" aria-label={f.accessibleName || f.label} />
              ) : f.type === 'select' ? (
                <select id={f.key} value={promptData[f.key] as string} onChange={e => onPromptDataChange(f.key, e.target.value)} className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100" aria-label={f.accessibleName || f.label}>
                  {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input type="text" id={f.key} value={promptData[f.key] as string} onChange={e => onPromptDataChange(f.key, e.target.value)} className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100" aria-label={f.accessibleName || f.label} />
              )}
            </div>
          ))}
          <div className="md:col-span-2">
            <label htmlFor="keywordsDisplay" className="block text-sm font-medium text-slate-300 mb-1">Keywords</label>
            <div id="keywordsDisplay" className="flex flex-wrap gap-2 p-2 bg-slate-800 border border-slate-700 rounded-md min-h-[40px]" aria-live="polite">
              {promptData.keywords.map(k => <Pill key={k} text={k} onRemove={() => onRemoveKeyword(k)} />)}
              {promptData.keywords.length === 0 && <span className="text-slate-500 text-sm p-1">No keywords added yet.</span>}
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between mt-6">
        <ActionButton onClick={onBack} icon={<ArrowLeftIcon />} variant="secondary">Back to Concepts</ActionButton>
        <ActionButton
          onClick={handleGenerate}
          disabled={fullPromptOp.isLoading || !isProviderReady}
          icon={fullPromptOp.isLoading ? <LoadingSpinner size="w-4 h-4" /> : <ArrowRightIcon />}
          title={!isProviderReady ? providerErrorMessage : 'Generate full prompt and proceed to refinement'}
        >
          Generate & Refine
        </ActionButton>
      </div>
      {!isProviderReady && !providerStatusChecking && (
        <p className="text-xs text-amber-400 mt-2">{providerErrorMessage} AI-powered prompt generation is disabled.</p>
      )}
    </div>
  );
};

export default PromptConstructionStage;
