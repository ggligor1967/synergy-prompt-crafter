import React from 'react';
import { AiConcepts } from '../../types';
import ActionButton from '../ActionButton';
import Pill from '../Pill';
import { ArrowLeftIcon, ArrowRightIcon } from '../Icons';

interface ConceptExplorationStageProps {
  aiConcepts: AiConcepts | null;
  keywords: string[];
  onAddKeyword: (k: string) => void;
  isProviderReady: boolean;
  activeProviderName: string;
  coreIdea: string;
  selectedDisciplines: string[];
  onNext: () => void;
  onBack: () => void;
}

const ConceptExplorationStage: React.FC<ConceptExplorationStageProps> = ({
  aiConcepts, keywords, onAddKeyword,
  isProviderReady, activeProviderName,
  coreIdea, selectedDisciplines,
  onNext, onBack,
}) => {
  const hasInput = coreIdea.trim() && selectedDisciplines.length > 0;

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-sky-400">AI-Suggested Concepts</h3>
      {aiConcepts && Object.keys(aiConcepts).length > 0 ? (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {Object.entries(aiConcepts).map(([discipline, concepts]) => (
            <div key={discipline} className="p-4 bg-slate-800 rounded-md">
              <h4 className="text-lg font-medium text-slate-300 mb-2">{discipline}</h4>
              <div className="flex flex-wrap gap-2">
                {concepts.map((concept, i) => {
                  const isKeyword = keywords.includes(concept);
                  return (
                    <Pill
                      key={`${discipline}-${i}-${concept}`}
                      text={concept}
                      onClick={() => onAddKeyword(concept)}
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
      ) : !isProviderReady && hasInput ? (
        <p className="text-amber-400">AI concept generation is disabled — {activeProviderName} is not available. You can proceed to construct your prompt manually.</p>
      ) : (
        <p className="text-slate-400">No concepts generated. Ensure you&apos;ve provided a core idea, selected disciplines, and that the provider is available. Otherwise, proceed to construct prompt manually.</p>
      )}
      <div className="flex justify-between mt-6">
        <ActionButton onClick={onBack} icon={<ArrowLeftIcon />} variant="secondary">Back to Ideation</ActionButton>
        <ActionButton onClick={onNext} icon={<ArrowRightIcon />}>Construct Prompt</ActionButton>
      </div>
    </div>
  );
};

export default ConceptExplorationStage;
