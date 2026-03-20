import React, { useState, useCallback } from 'react';
import { AIProvider } from '../../services/aiProvider';
import { AiConcepts } from '../../types';
import { PREDEFINED_DISCIPLINES } from '../../constants';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import ActionButton from '../ActionButton';
import Pill from '../Pill';
import LoadingSpinner from '../LoadingSpinner';
import { SparklesIcon, PlusCircleIcon } from '../Icons';

interface IdeationStageProps {
  coreIdea: string;
  onCoreIdeaChange: (v: string) => void;
  selectedDisciplines: string[];
  onDisciplinesChange: (disciplines: string[]) => void;
  isProviderReady: boolean;
  providerStatusChecking: boolean;
  providerErrorMessage: string;
  activeProvider: AIProvider;
  onConceptsGenerated: (concepts: AiConcepts) => void;
}

const IdeationStage: React.FC<IdeationStageProps> = ({
  coreIdea, onCoreIdeaChange,
  selectedDisciplines, onDisciplinesChange,
  isProviderReady, providerStatusChecking, providerErrorMessage,
  activeProvider, onConceptsGenerated,
}) => {
  const [customDiscipline, setCustomDiscipline] = useState('');

  const generateConceptsFn = useCallback(
    (idea: string, disciplines: string[]) => activeProvider.generateConcepts(idea, disciplines),
    [activeProvider]
  );
  const conceptsOp = useAsyncOperation(generateConceptsFn);

  const handleAddCustomDiscipline = () => {
    if (customDiscipline && !selectedDisciplines.includes(customDiscipline) && !PREDEFINED_DISCIPLINES.includes(customDiscipline)) {
      onDisciplinesChange([...selectedDisciplines, customDiscipline]);
      setCustomDiscipline('');
    }
  };

  const handleExplore = async () => {
    if (!coreIdea || selectedDisciplines.length === 0) return;
    try {
      const concepts = await conceptsOp.execute(coreIdea, selectedDisciplines);
      if (concepts) onConceptsGenerated(concepts);
    } catch { /* captured in conceptsOp.error */ }
  };

  return (
    <div className="space-y-6">
      {conceptsOp.error && (
        <div className="p-3 bg-red-800/50 border border-red-700 text-red-300 rounded-md text-sm" role="alert">
          <p className="font-semibold">Concept generation failed:</p>
          <p>{conceptsOp.error}</p>
        </div>
      )}
      <div>
        <label htmlFor="coreIdea" className="block text-sm font-medium text-slate-300 mb-1">Core Idea or Question</label>
        <textarea
          id="coreIdea"
          value={coreIdea}
          onChange={(e) => onCoreIdeaChange(e.target.value)}
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
          onChange={(e) => onDisciplinesChange(Array.from(e.target.selectedOptions, o => o.value))}
          className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-sky-500 focus:border-sky-500 text-slate-100 h-48 custom-scrollbar"
          aria-label="Select Disciplines"
        >
          {PREDEFINED_DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedDisciplines.map(d => (
            <Pill key={d} text={d} onRemove={() => onDisciplinesChange(selectedDisciplines.filter(x => x !== d))} />
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
        onClick={handleExplore}
        disabled={conceptsOp.isLoading || !coreIdea.trim() || selectedDisciplines.length === 0 || !isProviderReady}
        icon={conceptsOp.isLoading ? <LoadingSpinner size="w-4 h-4" /> : <SparklesIcon />}
        title={!isProviderReady ? providerErrorMessage : (!coreIdea.trim() || selectedDisciplines.length === 0 ? 'Enter core idea and select disciplines' : 'Explore concepts with AI')}
      >
        Explore Concepts
      </ActionButton>
      {!isProviderReady && !providerStatusChecking && (
        <p className="text-xs text-amber-400 mt-2">{providerErrorMessage} AI-powered concept exploration is disabled.</p>
      )}
    </div>
  );
};

export default IdeationStage;
