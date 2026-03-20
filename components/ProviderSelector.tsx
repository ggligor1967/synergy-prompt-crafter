import React from 'react';
import { AIProvider } from '../services/aiProvider';

interface ProviderInfo {
  provider: AIProvider;
  status: 'checking' | 'online' | 'offline';
}

interface ProviderSelectorProps {
  providers: ProviderInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const statusColors = {
  checking: 'bg-amber-400',
  online: 'bg-green-400',
  offline: 'bg-red-400',
};

const statusLabels = {
  checking: 'Checking…',
  online: 'Online',
  offline: 'Offline',
};

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ providers, selectedId, onSelect }) => {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">AI Provider:</span>
      <div className="flex gap-2">
        {providers.map(({ provider, status }) => {
          const isSelected = provider.id === selectedId;
          return (
            <button
              key={provider.id}
              onClick={() => onSelect(provider.id)}
              disabled={status === 'offline'}
              title={status === 'offline' ? `${provider.name} is unavailable` : `Switch to ${provider.name}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                ${isSelected
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : status === 'offline'
                    ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-sky-600 hover:text-sky-300'
                }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusColors[status]}`} />
              {provider.name}
              <span className="text-[10px] opacity-70">({statusLabels[status]})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProviderSelector;
