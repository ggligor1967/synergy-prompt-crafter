
import React from 'react';
import { AppStage } from '../types';

interface StageProgressBarProps {
  currentStage: AppStage;
  stages: { id: AppStage; name: string }[];
}

const StageProgressBar: React.FC<StageProgressBarProps> = ({ currentStage, stages }) => {
  const currentIndex = stages.findIndex(s => s.id === currentStage);

  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center justify-center space-x-1 sm:space-x-2 md:space-x-4">
        {stages.map((stage, index) => (
          <li key={stage.id} className="relative flex-1">
            {index < currentIndex && ( // Completed stage
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="h-0.5 w-full bg-sky-600" />
              </div>
            )}
             {index === currentIndex && index < stages.length -1 && ( // Current stage, not last
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="h-0.5 w-1/2 bg-sky-600" />
                <div className="h-0.5 w-1/2 bg-slate-600" />
              </div>
            )}
            {index > currentIndex && ( // Upcoming stage
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="h-0.5 w-full bg-slate-600" />
              </div>
            )}
            <div
              className={`relative flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-semibold
                ${index < currentIndex ? 'bg-sky-600 text-white hover:bg-sky-500' : ''}
                ${index === currentIndex ? 'border-2 border-sky-600 bg-slate-800 text-sky-400' : ''}
                ${index > currentIndex ? 'border-2 border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-400' : ''}
              `}
            >
             {index < currentIndex ? (
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              ) : (
                <span>{index + 1}</span>
              )}
              <span className="sr-only">{stage.name}</span>
            </div>
            <p className={`absolute -bottom-6 sm:-bottom-7 text-center w-full text-xs sm:text-sm
              ${index <= currentIndex ? 'text-slate-300' : 'text-slate-500'}
              ${index === currentIndex ? 'font-semibold text-sky-400' : ''}
              whitespace-nowrap truncate
            `}>
              {stage.name}
            </p>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default StageProgressBar;
