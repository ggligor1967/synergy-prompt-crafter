import React, { useCallback, useState } from 'react';
import { AIProvider } from '../../services/aiProvider';
import { PromptData } from '../../types';
import { TOAST_MESSAGES } from '../../constants';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import { useToast } from '../Toast';
import ActionButton from '../ActionButton';
import LoadingSpinner from '../LoadingSpinner';
import { ClipboardIcon, PaperAirplaneIcon, RefreshIcon, ArrowLeftIcon, BookmarkIcon, ArrowDownTrayIcon, ShareIcon } from '../Icons';

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
  coreIdea?: string;
  disciplines?: string[];
  promptData?: PromptData;
}

type ExportFormat = 'txt' | 'md' | 'json';

const FinalPromptStage: React.FC<FinalPromptStageProps> = ({
  generatedPrompt, isProviderReady, providerStatusChecking, providerErrorMessage,
  activeProvider, onCopyToClipboard, onReset, onBack, onSave,
  coreIdea = '', disciplines = [], promptData,
}) => {
  const { showToast } = useToast();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const testFn = useCallback(
    () => activeProvider.testGeneratedPrompt(generatedPrompt),
    [activeProvider, generatedPrompt]
  );
  const testPromptOp = useAsyncOperation(testFn);

  const handleTest = async () => {
    if (!generatedPrompt || !isProviderReady) return;
    try { await testPromptOp.execute(); } catch { /* captured in testPromptOp.error */ }
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: ExportFormat) => {
    setShowExportMenu(false);
    const ts = Date.now();
    if (format === 'txt') {
      triggerDownload(generatedPrompt, `prompt-${ts}.txt`, 'text/plain');
    } else if (format === 'md') {
      const disciplinesList = disciplines.length > 0 ? disciplines.join(', ') : 'N/A';
      const content = `# ${coreIdea || 'Prompt'}\n\n**Disciplines:** ${disciplinesList}\n\n\`\`\`\n${generatedPrompt}\n\`\`\`\n`;
      triggerDownload(content, `prompt-${ts}.md`, 'text/markdown');
    } else {
      const data = {
        title: coreIdea || 'Untitled Prompt',
        coreIdea,
        disciplines,
        promptData,
        generatedPrompt,
        exportedAt: new Date().toISOString(),
      };
      triggerDownload(JSON.stringify(data, null, 2), `prompt-${ts}.json`, 'application/json');
    }
  };

  const handleShare = () => {
    const data = { coreIdea, disciplines, promptData, generatedPrompt };
    const encoded = btoa(encodeURIComponent(JSON.stringify(data)));
    const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast(TOAST_MESSAGES.LINK_COPIED, 'success'))
      .catch(() => showToast(TOAST_MESSAGES.SHARE_FAILED, 'error'));
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
        {/* Export dropdown */}
        <div className="relative">
          <ActionButton
            onClick={() => setShowExportMenu(v => !v)}
            icon={<ArrowDownTrayIcon />}
            disabled={!generatedPrompt}
            variant="secondary"
            title="Export prompt"
          >
            Export
          </ActionButton>
          {showExportMenu && (
            <div className="absolute left-0 top-full mt-1 w-40 bg-slate-800 border border-slate-600 rounded-md shadow-lg z-10">
              <button
                onClick={() => handleExport('txt')}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-t-md"
              >
                Export as .txt
              </button>
              <button
                onClick={() => handleExport('md')}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Export as .md
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-b-md"
              >
                Export as .json
              </button>
            </div>
          )}
        </div>
        {/* Share button */}
        <ActionButton
          onClick={handleShare}
          icon={<ShareIcon />}
          disabled={!generatedPrompt}
          variant="secondary"
          title="Share this prompt"
        >
          Share
        </ActionButton>
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
