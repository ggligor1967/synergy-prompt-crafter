import React, { useCallback } from 'react';
import { AIProvider } from '../../services/aiProvider';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import ActionButton from '../ActionButton';
import LoadingSpinner from '../LoadingSpinner';
import { ClipboardIcon, PaperAirplaneIcon, RefreshIcon, ArrowLeftIcon, BookmarkIcon } from '../Icons';

interface FinalPromptStageProps {
  generatedPrompt: string;
  isProviderReady: boolean;
  providerStatusChecking: boolean;
  providerErrorMessage: string;
  activeProvider: AIProvider;
  onCopyToClipboard: (text: string) => void;
  onReset: () => void;
  onBack: () => void;
  onSave?: () => void;
}

const FinalPromptStage: React.FC<FinalPromptStageProps> = ({
  generatedPrompt, isProviderReady, providerStatusChecking, providerErrorMessage,
  activeProvider, onCopyToClipboard, onReset, onBack, onSave,
}) => {
  const testFn = useCallback(
    () => activeProvider.testGeneratedPrompt(generatedPrompt),
    [activeProvider, generatedPrompt]
  );
  const testPromptOp = useAsyncOperation(testFn);

  const handleTest = async () => {
    if (!generatedPrompt || !isProviderReady) return;
    try { await testPromptOp.execute(); } catch { /* captured in testPromptOp.error */ }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-green-400">Your Mastered Prompt!</h3>
      <div className="bg-slate-800 p-4 rounded-md border border-green-700 max-h-80 overflow-y-auto custom-scrollbar">
        <pre className="text-slate-100 whitespace-pre-wrap text-sm">{generatedPrompt || 'No prompt available.'}</pre>
      </div>
      <div className="flex flex-wrap gap-4">
        <ActionButton onClick={() => onCopyToClipboard(generatedPrompt)} icon={<ClipboardIcon />} disabled={!generatedPrompt} title="Copy prompt to clipboard">Copy Prompt</ActionButton>
        {onSave && (
          <ActionButton onClick={onSave} icon={<BookmarkIcon />} disabled={!generatedPrompt} variant="secondary" title="Save to history">Save to History</ActionButton>
        )}
        <ActionButton
          onClick={handleTest}
          icon={testPromptOp.isLoading ? <LoadingSpinner size="w-4 h-4" /> : <PaperAirplaneIcon />}
          disabled={!generatedPrompt || testPromptOp.isLoading || !isProviderReady}
          title={!isProviderReady ? providerErrorMessage : (!generatedPrompt ? 'No prompt to test' : 'Test this prompt with AI')}
        >
          Test Prompt with AI
        </ActionButton>
        <ActionButton onClick={onReset} icon={<RefreshIcon />} variant="secondary" title="Start crafting a new prompt">Start New Prompt</ActionButton>
      </div>
      {!isProviderReady && generatedPrompt && !providerStatusChecking && (
        <p className="text-xs text-amber-400 mt-2">{providerErrorMessage} AI prompt testing is disabled.</p>
      )}
      {testPromptOp.isLoading && (
        <div className="mt-4 p-4 bg-slate-700/50 rounded-md border border-slate-600 flex items-center justify-center">
          <LoadingSpinner size="w-6 h-6" />
          <p className="ml-3 text-slate-300">AI is thinking...</p>
        </div>
      )}
      {testPromptOp.error && (
        <div className="mt-4 p-3 bg-red-800/50 border border-red-700 text-red-300 rounded-md text-sm" role="alert">
          <p className="font-semibold">Test Error:</p>
          <p>{testPromptOp.error}</p>
        </div>
      )}
      {testPromptOp.data && (
        <div className="mt-4 space-y-2">
          <h4 className="text-lg font-semibold text-sky-300">AI Response:</h4>
          <div className="bg-slate-700/50 p-4 rounded-md border border-slate-600 max-h-60 overflow-y-auto custom-scrollbar">
            <pre className="text-slate-200 whitespace-pre-wrap text-sm">{testPromptOp.data}</pre>
          </div>
        </div>
      )}
      <div className="flex justify-between mt-6">
        <ActionButton onClick={onBack} icon={<ArrowLeftIcon />} variant="secondary">Back to Refinement</ActionButton>
      </div>
    </div>
  );
};

export default FinalPromptStage;
