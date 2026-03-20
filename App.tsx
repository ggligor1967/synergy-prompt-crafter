import React, { useState, useEffect, useCallback } from 'react';
import { AppStage, PromptData, AiConcepts, RefinementSuggestion } from './types';
import { INITIAL_PROMPT_DATA } from './constants';
import { AIProvider } from './services/aiProvider';
import { GeminiProvider, GEMINI_MODEL_STORAGE_KEY, getGeminiModel } from './services/geminiService';
import { OllamaProvider, OLLAMA_MODEL_STORAGE_KEY, listModels } from './services/ollamaService';
import { STAGES_CONFIG, getNextStage, getPrevStage } from './navigation';
import { loadWizardState, clearWizardState, useWizardPersistence } from './hooks/useWizardPersistence';
import StageProgressBar from './components/StageProgressBar';
import ProviderSelector from './components/ProviderSelector';
import SettingsPanel from './components/SettingsPanel';
import { useToast } from './components/Toast';
import { GearIcon, HistoryIcon } from './components/Icons';
import PromptHistory from './components/PromptHistory';
import { savePrompt } from './services/storage';
import IdeationStage from './components/stages/IdeationStage';
import ConceptExplorationStage from './components/stages/ConceptExplorationStage';
import PromptConstructionStage from './components/stages/PromptConstructionStage';
import AIRefinementStage from './components/stages/AIRefinementStage';
import FinalPromptStage from './components/stages/FinalPromptStage';

const ALL_PROVIDERS: AIProvider[] = [GeminiProvider, OllamaProvider];
type ProviderStatusState = 'checking' | 'online' | 'offline';

const App: React.FC = () => {
  const { showToast } = useToast();

  // Provider state
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() => localStorage.getItem('selectedProviderId') || 'gemini');
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatusState>>(() => Object.fromEntries(ALL_PROVIDERS.map(p => [p.id, 'checking' as ProviderStatusState])));
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>(() => localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY) || 'llama3');
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>(getGeminiModel);

  // Wizard state (lazy-restored from sessionStorage)
  const [savedState] = useState(loadWizardState);
  const [currentStage, setCurrentStage] = useState<AppStage>(savedState.currentStage ?? AppStage.IDEATION);
  const [coreIdea, setCoreIdea] = useState<string>(savedState.coreIdea ?? '');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(savedState.selectedDisciplines ?? []);
  const [aiConcepts, setAiConcepts] = useState<AiConcepts | null>(savedState.aiConcepts ?? null);
  const [promptData, setPromptData] = useState<PromptData>(savedState.promptData ?? INITIAL_PROMPT_DATA);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>(savedState.generatedPrompt ?? '');
  const [refinementSuggestions, setRefinementSuggestions] = useState<RefinementSuggestion[]>(savedState.refinementSuggestions ?? []);

  useWizardPersistence({ currentStage, coreIdea, selectedDisciplines, aiConcepts, promptData, generatedPrompt, refinementSuggestions });

  const activeProvider = ALL_PROVIDERS.find(p => p.id === selectedProviderId) ?? GeminiProvider;
  const isProviderReady = providerStatuses[selectedProviderId] === 'online';
  const providerStatusChecking = providerStatuses[selectedProviderId] === 'checking';
  const providerErrorMessage = `${activeProvider.name} is not available. ${selectedProviderId === 'ollama' ? 'Make sure Ollama is running: ollama serve' : 'Make sure the proxy server is running: npm start in server/'}`;

  useEffect(() => {
    ALL_PROVIDERS.forEach(async provider => {
      const result = await provider.status();
      setProviderStatuses(prev => ({ ...prev, [provider.id]: result.configured ? 'online' : 'offline' }));
      if (provider.id === 'ollama' && result.configured && !localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY)) {
        const models = await listModels();
        if (models.length > 0) { localStorage.setItem(OLLAMA_MODEL_STORAGE_KEY, models[0]); setSelectedOllamaModel(models[0]); }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectProvider = (id: string) => {
    localStorage.setItem('selectedProviderId', id);
    setSelectedProviderId(id);
    showToast(`Switched to ${ALL_PROVIDERS.find(p => p.id === id)?.name ?? id}`, 'info');
  };

  const handleNextStage = useCallback(() => setCurrentStage(prev => getNextStage(prev)), []);
  const handlePrevStage = useCallback(() => setCurrentStage(prev => getPrevStage(prev)), []);

  const handlePromptDataChange = useCallback((field: keyof PromptData, value: string | string[]) => {
    setPromptData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAddKeyword = useCallback((keyword: string) => {
    setPromptData(prev => {
      if (!keyword || prev.keywords.some(k => k.toLowerCase() === keyword.toLowerCase())) return prev;
      return { ...prev, keywords: [...prev.keywords, keyword] };
    });
  }, []);

  const handleRemoveKeyword = useCallback((keyword: string) => {
    setPromptData(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== keyword) }));
  }, []);

  const applySuggestion = useCallback((suggestion: RefinementSuggestion) => {
    setGeneratedPrompt(suggestion.promptText);
    setRefinementSuggestions([]);
  }, []);

  const resetApp = useCallback(() => {
    clearWizardState();
    setCurrentStage(AppStage.IDEATION);
    setCoreIdea('');
    setSelectedDisciplines([]);
    setAiConcepts(null);
    setPromptData(INITIAL_PROMPT_DATA);
    setGeneratedPrompt('');
    setRefinementSuggestions([]);
    ALL_PROVIDERS.forEach(async provider => {
      setProviderStatuses(prev => ({ ...prev, [provider.id]: 'checking' }));
      const result = await provider.status();
      setProviderStatuses(prev => ({ ...prev, [provider.id]: result.configured ? 'online' : 'offline' }));
    });
  }, []);

  const handleSavePrompt = useCallback(async () => {
    const title = coreIdea.slice(0, 60) || 'Untitled Prompt';
    await savePrompt({ title, coreIdea, promptData, generatedPrompt, disciplines: selectedDisciplines, tags: [], isFavorite: false });
    setHistoryRefreshTrigger(t => t + 1);
    showToast('Prompt saved to history!', 'success');
  }, [coreIdea, promptData, generatedPrompt, selectedDisciplines, showToast]);

  const handleRestorePrompt = useCallback((record: import('./services/storage').PromptRecord) => {
    setCoreIdea(record.coreIdea);
    setSelectedDisciplines(record.disciplines);
    setPromptData(record.promptData);
    setGeneratedPrompt(record.generatedPrompt);
    setCurrentStage(AppStage.FINAL_PROMPT);
    setShowHistory(false);
    showToast('Prompt restored!', 'success');
  }, [showToast]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Prompt copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy prompt.', 'error'));
  }, [showToast]);

  const stageProps = { isProviderReady, providerStatusChecking, providerErrorMessage, activeProvider };

  const renderStage = () => {
    switch (currentStage) {
      case AppStage.IDEATION:
        return <IdeationStage {...stageProps} coreIdea={coreIdea} onCoreIdeaChange={setCoreIdea} selectedDisciplines={selectedDisciplines} onDisciplinesChange={setSelectedDisciplines} onConceptsGenerated={(concepts) => { setAiConcepts(concepts); handleNextStage(); }} />;
      case AppStage.CONCEPT_EXPLORATION:
        return <ConceptExplorationStage aiConcepts={aiConcepts} keywords={promptData.keywords} onAddKeyword={handleAddKeyword} isProviderReady={isProviderReady} activeProviderName={activeProvider.name} coreIdea={coreIdea} selectedDisciplines={selectedDisciplines} onNext={handleNextStage} onBack={handlePrevStage} />;
      case AppStage.PROMPT_CONSTRUCTION:
        return <PromptConstructionStage {...stageProps} promptData={promptData} onPromptDataChange={handlePromptDataChange} onRemoveKeyword={handleRemoveKeyword} selectedDisciplines={selectedDisciplines} coreIdea={coreIdea} onPromptGenerated={(prompt) => { setGeneratedPrompt(prompt); setRefinementSuggestions([]); handleNextStage(); }} onBack={handlePrevStage} />;
      case AppStage.AI_REFINEMENT:
        return <AIRefinementStage {...stageProps} generatedPrompt={generatedPrompt} refinementSuggestions={refinementSuggestions} onSuggestionsChange={setRefinementSuggestions} onApplySuggestion={applySuggestion} onNext={handleNextStage} onBack={handlePrevStage} />;
      case AppStage.FINAL_PROMPT:
        return <FinalPromptStage {...stageProps} generatedPrompt={generatedPrompt} onCopyToClipboard={copyToClipboard} onReset={resetApp} onBack={handlePrevStage} onSave={handleSavePrompt} />;
      default:
        return <p>Unknown stage.</p>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-850 to-sky-900 text-slate-100" role="application">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-sky-400">Synergy Prompt Crafter</h1>
        <p className="text-slate-400">Craft complex multidisciplinary prompts with AI assistance.</p>
      </header>
      <main className="w-full max-w-3xl bg-slate-800/50 backdrop-blur-md shadow-2xl rounded-xl p-6 md:p-8">
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <ProviderSelector providers={ALL_PROVIDERS.map(p => ({ provider: p, status: providerStatuses[p.id] ?? 'checking' }))} selectedId={selectedProviderId} onSelect={handleSelectProvider} />
          <button onClick={() => setShowHistory(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 border border-slate-700 bg-slate-800 hover:border-sky-600 hover:text-sky-300 transition-all" title="Prompt history" aria-label="Prompt history">
            <HistoryIcon className="w-4 h-4" />
            History
          </button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 border border-slate-700 bg-slate-800 hover:border-sky-600 hover:text-sky-300 transition-all" title="Open settings" aria-label="Open settings">
            <GearIcon className="w-4 h-4" />
            Settings
          </button>
        </div>
        {showSettings && (
          <SettingsPanel
            selectedOllamaModel={selectedOllamaModel}
            onModelChange={(m) => { localStorage.setItem(OLLAMA_MODEL_STORAGE_KEY, m); setSelectedOllamaModel(m); }}
            selectedGeminiModel={selectedGeminiModel}
            onGeminiModelChange={(m) => { localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, m); setSelectedGeminiModel(m); }}
            onClose={() => setShowSettings(false)}
          />
        )}
        <div className="mb-8 pt-4 pb-8">
          <StageProgressBar currentStage={currentStage} stages={STAGES_CONFIG} />
        </div>
        {!isProviderReady && !providerStatusChecking && (
          <div className="mb-4 p-3 bg-amber-700/50 border border-amber-600 text-amber-200 rounded-md text-sm" role="alert">
            <p className="font-semibold">Provider Notice:</p>
            <p>{providerErrorMessage}</p>
          </div>
        )}
        {renderStage()}
      </main>
      {showHistory && (
        <PromptHistory
          onRestore={handleRestorePrompt}
          onClose={() => setShowHistory(false)}
          refreshTrigger={historyRefreshTrigger}
        />
      )}
      <footer className="mt-12 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Synergy Prompt Crafter. Powered by {activeProvider.name}.</p>
      </footer>
    </div>
  );
};

export default App;
