import React, { useCallback } from 'react';
import { RefinementSuggestion } from '../../types';
import { AIProvider } from '../../services/aiProvider';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import ActionButton from '../ActionButton';
import LoadingSpinner from '../LoadingSpinner';
import { SparklesIcon, LightBulbIcon, ArrowLeftIcon, ArrowRightIcon } from '../Icons';

interface AIRefinementStageProps {
  generatedPrompt: string;
  refinementSuggestions: RefinementSuggestion[];
  onSuggestionsChange: (suggestions: RefinementSuggestion[]) => void;
  onApplySuggestion: (s: RefinementSuggestion) => void;
  isProviderReady: boolean;
  providerStatusChecking: boolean;
  providerErrorMessage: string;
  activeProvider: AIProvider;
  onNext: () => void;
  onBack: () => void;
}

const AIRefinementStage: React.FC<AIRefinementStageProps> = ({
  generatedPrompt, refinementSuggestions, onSuggestionsChange, onApplySuggestion,
  isProviderReady, providerStatusChecking, providerErrorMessage,
  activeProvider, onNext, onBack,
}) => {
  const variationsFn = useCallback(
    () => activeProvider.generatePromptVariations(generatedPrompt),
    [activeProvider, generatedPrompt]
  );
  const improvementsFn = useCallback(
    () => activeProvider.suggestImprovements(generatedPrompt),
    [activeProvider, generatedPrompt]
  );
  const variationsOp = useAsyncOperation(variationsFn);
  const improvementsOp = useAsyncOperation(improvementsFn);
  const isLoading = variationsOp.isLoading || improvementsOp.isLoading;

  const fetchVariations = async () => {
    if (!generatedPrompt) return;
    try {
      const variations = await variationsOp.execute();
      if (variations) onSuggestionsChange([...refinementSuggestions.filter(s => s.type !== 'variation'), ...variations]);
    } catch { /* captured in variationsOp.error */ }
  };

  const fetchImprovements = async () => {
    if (!generatedPrompt) return;
    try {
      const improvements = await improvementsOp.execute();
      if (improvements) onSuggestionsChange([...refinementSuggestions.filter(s => s.type !== 'improvement'), ...improvements]);
    } catch { /* captured in improvementsOp.error */ }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-sky-400">Refine Your Prompt</h3>
      <div className="bg-slate-800 p-4 rounded-md border border-slate-700 max-h-60 overflow-y-auto custom-scrollbar">
        <h4 className="text-lg font-medium text-slate-300 mb-2">Current Prompt Draft:</h4>
        <p className="text-slate-200 whitespace-pre-wrap">{generatedPrompt || 'Prompt not generated yet.'}</p>
      </div>
      {(variationsOp.error || improvementsOp.error) && (
        <div className="p-3 bg-red-800/50 border border-red-700 text-red-300 rounded-md text-sm" role="alert">
          <p className="font-semibold">{variationsOp.error ? 'Variation generation failed:' : 'Improvement suggestions failed:'}</p>
          <p>{variationsOp.error || improvementsOp.error}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        <ActionButton
          onClick={fetchVariations}
          disabled={isLoading || !generatedPrompt || !isProviderReady}
          icon={variationsOp.isLoading ? <LoadingSpinner size="w-4 h-4" /> : <SparklesIcon />}
          title={!isProviderReady ? providerErrorMessage : (!generatedPrompt ? 'Generate a prompt first' : 'Generate prompt variations')}
        >
          Generate Variations
        </ActionButton>
        <ActionButton
          onClick={fetchImprovements}
          disabled={isLoading || !generatedPrompt || !isProviderReady}
          icon={improvementsOp.isLoading ? <LoadingSpinner size="w-4 h-4" /> : <LightBulbIcon />}
          title={!isProviderReady ? providerErrorMessage : (!generatedPrompt ? 'Generate a prompt first' : 'Suggest prompt improvements')}
        >
          Suggest Improvements
        </ActionButton>
      </div>
      {!isProviderReady && generatedPrompt && !providerStatusChecking && (
        <p className="text-xs text-amber-400 mt-2">{providerErrorMessage} AI-powered refinement is disabled.</p>
      )}
      {isLoading && refinementSuggestions.length === 0 && (
        <div className="flex justify-center py-4"><LoadingSpinner /></div>
      )}
      {refinementSuggestions.length > 0 && (
        <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
          {refinementSuggestions.map(suggestion => (
            <div key={suggestion.id} className="bg-slate-800/70 p-3 rounded-md border border-slate-700">
              <p className="text-sm text-slate-400 mb-1 capitalize">{suggestion.type}</p>
              {suggestion.explanation && (
                <p className="text-slate-400 whitespace-pre-wrap text-sm mb-2 italic">{suggestion.explanation}</p>
              )}
              <p className="text-slate-200 whitespace-pre-wrap text-sm mb-2">{suggestion.promptText}</p>
              <ActionButton onClick={() => onApplySuggestion(suggestion)} variant="secondary">
                Use This {suggestion.type === 'variation' ? 'Variation' : 'Improvement'}
              </ActionButton>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between mt-6">
        <ActionButton onClick={onBack} icon={<ArrowLeftIcon />} variant="secondary">Back to Construction</ActionButton>
        <ActionButton onClick={onNext} disabled={!generatedPrompt} icon={<ArrowRightIcon />}>Finalize Prompt</ActionButton>
      </div>
    </div>
  );
};

export default AIRefinementStage;
