
import React, { useState, useEffect, useCallback } from 'react';
import { AppStage, PromptData, AiConcepts, RefinementSuggestion } from './types';
import { PREDEFINED_DISCIPLINES, INITIAL_PROMPT_DATA, PROMPT_TONES, PROMPT_FORMATS } from './constants';
import { AIProvider } from './services/aiProvider';
import { GeminiProvider, GEMINI_MODEL_STORAGE_KEY, getGeminiModel } from './services/geminiService';
import { OllamaProvider, OLLAMA_MODEL_STORAGE_KEY, listModels } from './services/ollamaService';
import { STAGES_CONFIG, getNextStage, getPrevStage } from './navigation';
import { loadWizardState, clearWizardState, useWizardPersistence } from './hooks/useWizardPersistence';
import { useAsyncOperation } from './hooks/useAsyncOperation';
import LoadingSpinner from './components/LoadingSpinner';
import ActionButton from './components/ActionButton';
import Pill from './components/Pill';
import StageProgressBar from './components/StageProgressBar';
import ProviderSelector from './components/ProviderSelector';
import SettingsPanel from './components/SettingsPanel';
import { useToast } from './components/Toast';
import { SparklesIcon, LightBulbIcon, ArrowRightIcon, ArrowLeftIcon, ClipboardIcon, RefreshIcon, PlusCircleIcon, PaperAirplaneIcon, GearIcon } from './components/Icons';

const ALL_PROVIDERS: AIProvider[] = [GeminiProvider, OllamaProvider];

type ProviderStatusState = 'checking' | 'online' | 'offline';

const App: React.FC = () => {
  const { showToast } = useToast();

  // Provider state
  const [selectedProviderId, setSelectedProviderId] = useState<string>(() =>
    localStorage.getItem('selectedProviderId') || 'gemini'
  );
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatusState>>(
    () => Object.fromEntries(ALL_PROVIDERS.map(p => [p.id, 'checking' as ProviderStatusState]))
  );

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>(
    () => localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY) || 'llama3'
  );
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<string>(getGeminiModel);

  const handleModelChange = (model: string) => {
    localStorage.setItem(OLLAMA_MODEL_STORAGE_KEY, model);
    setSelectedOllamaModel(model);
  };

  const handleGeminiModelChange = (model: string) => {
    localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, model);
    setSelectedGeminiModel(model);
  };

  const activeProvider: AIProvider =
    ALL_PROVIDERS.find(p => p.id === selectedProviderId) ?? GeminiProvider;

  // P4.1 — Restore wizard state from sessionStorage on mount (lazy, runs once).
  const [savedState] = useState(loadWizardState);

  // App state — initial values come from sessionStorage when available.
  const [currentStage, setCurrentStage] = useState<AppStage>(
    savedState.currentStage ?? AppStage.IDEATION
  );
  const [coreIdea, setCoreIdea] = useState<string>(savedState.coreIdea ?? '');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(
    savedState.selectedDisciplines ?? []
  );
  const [customDiscipline, setCustomDiscipline] = useState<string>('');
  const [aiConcepts, setAiConcepts] = useState<AiConcepts | null>(savedState.aiConcepts ?? null);
  const [promptData, setPromptData] = useState<PromptData>(savedState.promptData ?? INITIAL_PROMPT_DATA);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>(savedState.generatedPrompt ?? '');
  const [refinementSuggestions, setRefinementSuggestions] = useState<RefinementSuggestion[]>(
    savedState.refinementSuggestions ?? []
  );

  // P4.1 — Persist wizard state to sessionStorage on every meaningful change.
  useWizardPersistence({
    currentStage, coreIdea, selectedDisciplines,
    aiConcepts, promptData, generatedPrompt, refinementSuggestions,
  });

  // P5.2 — Memoize async functions so `execute` refs are stable between renders.
  // Without useCallback, inline arrows create new function references every render,
  // causing useAsyncOperation's internal useCallback to also recreate on every render.
  const generateConceptsFn = useCallback(
    (idea: string, disciplines: string[]) => activeProvider.generateConcepts(idea, disciplines),
    [activeProvider]
  );
  const generateFullPromptFn = useCallback(
    () => activeProvider.generateFullPromptFromData(promptData, selectedDisciplines, coreIdea),
    [activeProvider, promptData, selectedDisciplines, coreIdea]
  );
  const generateVariationsFn = useCallback(
    () => activeProvider.generatePromptVariations(generatedPrompt),
    [activeProvider, generatedPrompt]
  );
  const generateImprovementsFn = useCallback(
    () => activeProvider.suggestImprovements(generatedPrompt),
    [activeProvider, generatedPrompt]
  );
  const testPromptFn = useCallback(
    () => activeProvider.testGeneratedPrompt(generatedPrompt),
    [activeProvider, generatedPrompt]
  );

  // Async operation hooks — replace manual isLoading/error state per operation
  const conceptsOp = useAsyncOperation(generateConceptsFn);
  const fullPromptOp = useAsyncOperation(generateFullPromptFn);
  const variationsOp = useAsyncOperation(generateVariationsFn);
  const improvementsOp = useAsyncOperation(generateImprovementsFn);
  const testPromptOp = useAsyncOperation(testPromptFn);

  // Computed loading / error state
  const isLoading = conceptsOp.isLoading || fullPromptOp.isLoading || variationsOp.isLoading || improvementsOp.isLoading;
  const error =
    (conceptsOp.error ? 'Concept generation failed: ' + conceptsOp.error : null) ||
    (fullPromptOp.error ? 'Prompt construction failed: ' + fullPromptOp.error : null) ||
    (variationsOp.error ? 'Variation generation failed: ' + variationsOp.error : null) ||
    (improvementsOp.error ? 'Improvement suggestions failed: ' + improvementsOp.error : null);
  const isTestingPrompt = testPromptOp.isLoading;

  // Check all provider statuses on mount; auto-select first Ollama model if none saved
  useEffect(() => {
    ALL_PROVIDERS.forEach(async provider => {
      const result = await provider.status();
      setProviderStatuses(prev => ({
        ...prev,
        [provider.id]: result.configured ? 'online' : 'offline',
      }));
      // If Ollama just came online and no model is stored yet, pick the first available
      if (provider.id === 'ollama' && result.configured && !localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY)) {
        const models = await listModels();
        if (models.length > 0) {
          handleModelChange(models[0]);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist provider selection
  const handleSelectProvider = (id: string) => {
    localStorage.setItem('selectedProviderId', id);
    setSelectedProviderId(id);
    conceptsOp.reset(); fullPromptOp.reset(); variationsOp.reset(); improvementsOp.reset();
    showToast(`Switched to ${ALL_PROVIDERS.find(p => p.id === id)?.name ?? id}`, 'info');
  };

  const isProviderReady = providerStatuses[selectedProviderId] === 'online';

  // Clear test response when prompt changes
  useEffect(() => {
    testPromptOp.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedPrompt]);

  const handleNextStage = () => {
    conceptsOp.reset(); fullPromptOp.reset(); variationsOp.reset(); improvementsOp.reset();
    setCurrentStage(prev => getNextStage(prev));
  };

  const handlePrevStage = () => {
    conceptsOp.reset(); fullPromptOp.reset(); variationsOp.reset(); improvementsOp.reset();
    if (currentStage === AppStage.FINAL_PROMPT) {
      testPromptOp.reset();
    }
    setCurrentStage(prev => getPrevStage(prev));
  };
  
  const handleAddCustomDiscipline = () => {
    if (customDiscipline && !selectedDisciplines.includes(customDiscipline) && !PREDEFINED_DISCIPLINES.includes(customDiscipline)) {
      setSelectedDisciplines(prev => [...prev, customDiscipline]);
      setCustomDiscipline("");
    }
  };

  const handleRemoveDiscipline = (discipline: string) => {
    setSelectedDisciplines(prev => prev.filter(d => d !== discipline));
  };
  
  const fetchAiConcepts = async () => {
    if (!coreIdea || selectedDisciplines.length === 0) return;
    setAiConcepts(null);
    try {
      const concepts = await conceptsOp.execute(coreIdea, selectedDisciplines);
      setAiConcepts(concepts);
      handleNextStage();
    } catch { /* error captured in conceptsOp.error */ }
  };

  const handlePromptDataChange = (field: keyof PromptData, value: string | string[]) => {
    setPromptData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddKeyword = (keyword: string) => {
    // Check if keyword already exists (case-insensitive for robustness, though current comparisons are case-sensitive)
    const keywordExists = promptData.keywords.some(k => k.toLowerCase() === keyword.toLowerCase());
    if (keyword && !keywordExists) {
      handlePromptDataChange('keywords', [...promptData.keywords, keyword]);
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    handlePromptDataChange('keywords', promptData.keywords.filter(k => k !== keyword));
  };

  const constructFullPrompt = async () => {
    try {
      const fullPrompt = await fullPromptOp.execute();
      setGeneratedPrompt(fullPrompt);
      setRefinementSuggestions([]);
      handleNextStage();
    } catch { /* error captured in fullPromptOp.error */ }
  };


  const fetchVariations = async () => {
    if (!generatedPrompt) return;
    try {
      const variations = await variationsOp.execute();
      setRefinementSuggestions(prev => [...prev.filter(s => s.type !== 'variation'), ...variations]);
    } catch { /* error captured in variationsOp.error */ }
  };

  const fetchImprovements = async () => {
    if (!generatedPrompt) return;
    try {
      const improvements = await improvementsOp.execute();
      setRefinementSuggestions(prev => [...prev.filter(s => s.type !== 'improvement'), ...improvements]);
    } catch { /* error captured in improvementsOp.error */ }
  };
  
  const applySuggestion = (suggestion: RefinementSuggestion) => {
    setGeneratedPrompt(suggestion.promptText);
    setRefinementSuggestions([]);
  };

  const handleTestPrompt = async () => {
    if (!generatedPrompt || !isProviderReady) return;
    try {
      await testPromptOp.execute();
    } catch { /* error captured in testPromptOp.error */ }
  };

  const resetApp = async () => {
    clearWizardState();
    setCurrentStage(AppStage.IDEATION);
    setCoreIdea('');
    setSelectedDisciplines([]);
    setCustomDiscipline('');
    setAiConcepts(null);
    setPromptData(INITIAL_PROMPT_DATA);
    setGeneratedPrompt('');
    setRefinementSuggestions([]);
    conceptsOp.reset();
    fullPromptOp.reset();
    variationsOp.reset();
    improvementsOp.reset();
    testPromptOp.reset();

    // Re-check provider statuses
    ALL_PROVIDERS.forEach(async provider => {
      setProviderStatuses(prev => ({ ...prev, [provider.id]: 'checking' }));
      const result = await provider.status();
      setProviderStatuses(prev => ({
        ...prev,
        [provider.id]: result.configured ? 'online' : 'offline',
      }));
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Prompt copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy prompt.', 'error'));
  };

  const providerErrorMessage = `${activeProvider.name} is not available. ${
    selectedProviderId === 'ollama'
      ? 'Make sure Ollama is running: ollama serve'
      : 'Make sure the proxy server is running: npm start in server/'
  }`;

  const renderStageContent = () => {
    if (!isProviderReady &&
        currentStage !== AppStage.IDEATION &&
        !(currentStage === AppStage.CONCEPT_EXPLORATION && (aiConcepts || !coreIdea.trim() || selectedDisciplines.length === 0)) &&
        currentStage !== AppStage.PROMPT_CONSTRUCTION) {
      return (
        <div className="text-center p-8 bg-slate-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold text-red-400 mb-4">Provider Unavailable</h2>
          <p className="text-slate-300">{providerErrorMessage}</p>
          <ActionButton onClick={resetApp} className="mt-6" variant="secondary">Go to Start</ActionButton>
        </div>
      );
    }

    switch (currentStage) {
      case AppStage.IDEATION:
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="coreIdea" className="block text-sm font-medium text-slate-300 mb-1">Core Idea or Question</label>
              <textarea
                id="coreIdea"
                value={coreIdea}
                onChange={(e) => setCoreIdea(e.target.value)}
                placeholder="e.g., The impact of AI on Renaissance art interpretation"
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 custom-scrollbar"
                rows={4}
                aria-label="Core Idea or Question"
              />
            </div>
            <div>
              <label htmlFor="disciplineSelect" className="block text-sm font-medium text-slate-300 mb-1">Select Disciplines (Ctrl/Cmd + Click for multiple)</label>
              <select
                id="disciplineSelect"
                multiple
                value={selectedDisciplines}
                onChange={(e) => setSelectedDisciplines(Array.from(e.target.selectedOptions, option => option.value))}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 h-48 custom-scrollbar"
                aria-label="Select Disciplines"
              >
                {PREDEFINED_DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
               <div className="mt-2 space-y-1 flex flex-wrap gap-2">
                {selectedDisciplines.map(d => (
                  <Pill key={d} text={d} onRemove={() => handleRemoveDiscipline(d)} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-grow">
                <label htmlFor="customDiscipline" className="block text-sm font-medium text-slate-300 mb-1">Add Custom Discipline</label>
                <input
                  type="text"
                  id="customDiscipline"
                  value={customDiscipline}
                  onChange={(e) => setCustomDiscipline(e.target.value)}
                  placeholder="e.g., Quantum Gastronomy"
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100"
                  aria-label="Add Custom Discipline"
                />
              </div>
              <ActionButton onClick={handleAddCustomDiscipline} disabled={!customDiscipline.trim()} icon={<PlusCircleIcon />} className="h-[46px]">Add</ActionButton>
            </div>
            <ActionButton 
              onClick={fetchAiConcepts} 
              disabled={isLoading || !coreIdea.trim() || selectedDisciplines.length === 0 || !isProviderReady} 
              icon={isLoading ? <LoadingSpinner size="w-4 h-4"/> : <SparklesIcon />}
              title={!isProviderReady ? providerErrorMessage : (!coreIdea.trim() || selectedDisciplines.length === 0 ? 'Enter core idea and select disciplines' : 'Explore concepts with AI')}
            >
              Explore Concepts
            </ActionButton>
            {!isProviderReady && providerStatuses[selectedProviderId] !== 'checking' && (
              <p className="text-xs text-amber-400 mt-2">{providerErrorMessage} AI-powered concept exploration is disabled.</p>
            )}
          </div>
        );
      case AppStage.CONCEPT_EXPLORATION:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-sky-400">AI-Suggested Concepts</h3>
            {isLoading && <div className="flex justify-center"><LoadingSpinner /></div>}
            {aiConcepts && Object.keys(aiConcepts).length > 0 ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {Object.entries(aiConcepts).map(([discipline, concepts]) => (
                  <div key={discipline} className="p-4 bg-slate-800 rounded-md">
                    <h4 className="text-lg font-medium text-slate-300 mb-2">{discipline}</h4>
                    <div className="flex flex-wrap gap-2">
                      {concepts.map((concept, i) => {
                        const isKeyword = promptData.keywords.includes(concept);
                        return (
                          <Pill 
                            key={`${discipline}-${i}-${concept}`} 
                            text={concept} 
                            onClick={() => handleAddKeyword(concept)}
                            color={isKeyword ? 'bg-sky-600' : 'bg-slate-700'}
                            textColor={isKeyword ? 'text-white' : 'text-slate-200'}
                            className={`transition-all duration-150 ${isKeyword ? 'ring-2 ring-sky-400 ring-offset-slate-800 ring-offset-1' : 'hover:bg-sky-700'} ${!isKeyword ? 'cursor-pointer' : 'cursor-default'}`}
                            title={isKeyword ? "Added as keyword (manage in 'Construct' stage)" : "Click to add to prompt keywords"}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : !isLoading && !isProviderReady && (coreIdea.trim() && selectedDisciplines.length > 0) && <p className="text-amber-400">AI concept generation is disabled — {activeProvider.name} is not available. You can proceed to construct your prompt manually.</p>}
            {!isLoading && (!aiConcepts || Object.keys(aiConcepts).length === 0) && (isProviderReady || (!coreIdea.trim() || selectedDisciplines.length === 0)) && <p className="text-slate-400">No concepts generated. Ensure you&apos;ve provided a core idea, selected disciplines, and that the provider is available. Otherwise, proceed to construct prompt manually.</p>}
             <div className="flex justify-between mt-6">
                <ActionButton onClick={handlePrevStage} icon={<ArrowLeftIcon />} variant="secondary">Back to Ideation</ActionButton>
                <ActionButton onClick={handleNextStage} icon={<ArrowRightIcon />}>Construct Prompt</ActionButton>
            </div>
          </div>
        );
      case AppStage.PROMPT_CONSTRUCTION:
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[65vh] overflow-y-auto custom-scrollbar pr-2">
              {fields.map(f => (
                <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label htmlFor={f.key} className="block text-sm font-medium text-slate-300 mb-1">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea id={f.key} value={promptData[f.key] as string} onChange={e => handlePromptDataChange(f.key, e.target.value)} rows={3} className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 custom-scrollbar" aria-label={f.accessibleName || f.label} />
                  ) : f.type === 'select' ? (
                     <select id={f.key} value={promptData[f.key] as string} onChange={e => handlePromptDataChange(f.key, e.target.value)} className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100" aria-label={f.accessibleName || f.label}>
                        {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                     </select>
                  ) : (
                    <input type="text" id={f.key} value={promptData[f.key] as string} onChange={e => handlePromptDataChange(f.key, e.target.value)} className="w-full p-2 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100" aria-label={f.accessibleName || f.label} />
                  )}
                </div>
              ))}
              <div className="md:col-span-2">
                <label htmlFor="keywordsDisplay" className="block text-sm font-medium text-slate-300 mb-1">Keywords</label>
                <div id="keywordsDisplay" className="flex flex-wrap gap-2 p-2 bg-slate-800 border border-slate-700 rounded-md min-h-[40px]" aria-live="polite">
                    {promptData.keywords.map(k => <Pill key={k} text={k} onRemove={() => handleRemoveKeyword(k)} />)}
                    {promptData.keywords.length === 0 && <span className="text-slate-500 text-sm p-1">No keywords added yet.</span>}
                </div>
              </div>
            </div>
             <div className="flex justify-between mt-6">
                <ActionButton onClick={handlePrevStage} icon={<ArrowLeftIcon />} variant="secondary">Back to Concepts</ActionButton>
                <ActionButton 
                  onClick={constructFullPrompt} 
                  disabled={isLoading || !isProviderReady} 
                  icon={isLoading ? <LoadingSpinner size="w-4 h-4"/> : <ArrowRightIcon />}
                  title={!isProviderReady ? providerErrorMessage : 'Generate full prompt and proceed to refinement'}
                >
                  Generate & Refine
                </ActionButton>
            </div>
            {!isProviderReady && providerStatuses[selectedProviderId] !== 'checking' && (
              <p className="text-xs text-amber-400 mt-2">{providerErrorMessage} AI-powered prompt generation is disabled.</p>
            )}
          </div>
        );
      case AppStage.AI_REFINEMENT:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-sky-400">Refine Your Prompt</h3>
            <div className="bg-slate-800 p-4 rounded-md border border-slate-700 max-h-60 overflow-y-auto custom-scrollbar">
              <h4 className="text-lg font-medium text-slate-300 mb-2">Current Prompt Draft:</h4>
              <p className="text-slate-200 whitespace-pre-wrap">{generatedPrompt || "Prompt not generated yet."}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <ActionButton 
                onClick={fetchVariations} 
                disabled={isLoading || !generatedPrompt || !isProviderReady} 
                icon={variationsOp.isLoading ? <LoadingSpinner size="w-4 h-4"/> : <SparklesIcon />}
                title={!isProviderReady ? providerErrorMessage : (!generatedPrompt ? 'Generate a prompt first' : 'Generate prompt variations')}
              >
                Generate Variations
              </ActionButton>
              <ActionButton 
                onClick={fetchImprovements} 
                disabled={isLoading || !generatedPrompt || !isProviderReady} 
                icon={improvementsOp.isLoading ? <LoadingSpinner size="w-4 h-4"/> : <LightBulbIcon />}
                title={!isProviderReady ? providerErrorMessage : (!generatedPrompt ? 'Generate a prompt first' : 'Suggest prompt improvements')}
              >
                Suggest Improvements
              </ActionButton>
            </div>
            {!isProviderReady && generatedPrompt && providerStatuses[selectedProviderId] !== 'checking' && (
              <p className="text-xs text-amber-400 mt-2">{providerErrorMessage} AI-powered refinement is disabled.</p>
            )}
            {isLoading && refinementSuggestions.length === 0 && <div className="flex justify-center py-4"><LoadingSpinner /></div>}
            {refinementSuggestions.length > 0 && (
              <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                {refinementSuggestions.map(suggestion => (
                  <div key={suggestion.id} className="bg-slate-800/70 p-3 rounded-md border border-slate-700">
                    <p className="text-sm text-slate-400 mb-1 capitalize">{suggestion.type}</p>
                    {suggestion.explanation && (
                      <p className="text-slate-400 whitespace-pre-wrap text-sm mb-2 italic">{suggestion.explanation}</p>
                    )}
                    <p className="text-slate-200 whitespace-pre-wrap text-sm mb-2">{suggestion.promptText}</p>
                    <ActionButton
                      onClick={() => applySuggestion(suggestion)}
                      variant="secondary"
                    >
                      Use This {suggestion.type === 'variation' ? 'Variation' : 'Improvement'}
                    </ActionButton>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between mt-6">
                <ActionButton onClick={handlePrevStage} icon={<ArrowLeftIcon />} variant="secondary">Back to Construction</ActionButton>
                <ActionButton onClick={handleNextStage} disabled={!generatedPrompt} icon={<ArrowRightIcon />}>Finalize Prompt</ActionButton>
            </div>
          </div>
        );
      case AppStage.FINAL_PROMPT:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-green-400">Your Mastered Prompt!</h3>
            <div className="bg-slate-800 p-4 rounded-md border border-green-700 max-h-80 overflow-y-auto custom-scrollbar">
              <pre className="text-slate-100 whitespace-pre-wrap text-sm">{generatedPrompt || "No prompt available."}</pre>
            </div>
            <div className="flex flex-wrap gap-4">
              <ActionButton onClick={() => copyToClipboard(generatedPrompt)} icon={<ClipboardIcon />} disabled={!generatedPrompt} title="Copy prompt to clipboard">Copy Prompt</ActionButton>
              <ActionButton 
                onClick={handleTestPrompt} 
                icon={isTestingPrompt ? <LoadingSpinner size="w-4 h-4" /> : <PaperAirplaneIcon />} 
                disabled={!generatedPrompt || isTestingPrompt || !isProviderReady}
                title={!isProviderReady ? providerErrorMessage : (!generatedPrompt ? 'No prompt to test' : 'Test this prompt with AI')}
              >
                Test Prompt with AI
              </ActionButton>
              <ActionButton onClick={resetApp} icon={<RefreshIcon />} variant="secondary" title="Start crafting a new prompt">Start New Prompt</ActionButton>
            </div>
            {!isProviderReady && generatedPrompt && providerStatuses[selectedProviderId] !== 'checking' && (
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
                <ActionButton onClick={handlePrevStage} icon={<ArrowLeftIcon />} variant="secondary">Back to Refinement</ActionButton>
            </div>
          </div>
        );
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
          <ProviderSelector
            providers={ALL_PROVIDERS.map(p => ({ provider: p, status: providerStatuses[p.id] ?? 'checking' }))}
            selectedId={selectedProviderId}
            onSelect={handleSelectProvider}
          />
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 border border-slate-700 bg-slate-800 hover:border-sky-600 hover:text-sky-300 transition-all"
            title="Open settings"
            aria-label="Open settings"
          >
            <GearIcon className="w-4 h-4" />
            Settings
          </button>
        </div>

        {showSettings && (
          <SettingsPanel
            selectedOllamaModel={selectedOllamaModel}
            onModelChange={handleModelChange}
            selectedGeminiModel={selectedGeminiModel}
            onGeminiModelChange={handleGeminiModelChange}
            onClose={() => setShowSettings(false)}
          />
        )}

        <div className="mb-8 pt-4 pb-8">
          <StageProgressBar currentStage={currentStage} stages={STAGES_CONFIG} />
        </div>

        {error && isProviderReady && (
          <div className="mb-4 p-3 bg-red-800/50 border border-red-700 text-red-300 rounded-md text-sm" role="alert">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}
        {!isProviderReady && providerStatuses[selectedProviderId] !== 'checking' && (
          <div className="mb-4 p-3 bg-amber-700/50 border border-amber-600 text-amber-200 rounded-md text-sm" role="alert">
            <p className="font-semibold">Provider Notice:</p>
            <p>{providerErrorMessage}</p>
          </div>
        )}

        {fullPromptOp.isLoading && (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="w-12 h-12" />
          </div>
        )}

        {renderStageContent()}
      </main>

      <footer className="mt-12 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Synergy Prompt Crafter. Powered by {activeProvider.name}.</p>
      </footer>
    </div>
  );
};

export default App;
