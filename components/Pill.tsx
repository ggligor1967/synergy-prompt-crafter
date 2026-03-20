import React from 'react';

interface PillProps {
  text: string;
  color?: string; // Tailwind color class e.g., bg-blue-500
  textColor?: string; // Tailwind text color class e.g., text-white
  onClick?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  className?: string;
  title?: string; // Added title prop for tooltips
}

const Pill: React.FC<PillProps> = ({
  text,
  color = 'bg-slate-700',
  textColor = 'text-slate-200',
  onClick,
  onRemove,
  size = 'md',
  className = '',
  title
}) => {
  const baseStyles = `inline-flex items-center rounded-full font-medium ${textColor} ${color} ${className}`;
  const sizeStyles = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  const clickableStyles = onClick ? 'cursor-pointer hover:opacity-80' : '';

  return (
    <span
      className={`${baseStyles} ${sizeStyles} ${clickableStyles}`}
      onClick={onClick}
      title={title} // Apply title attribute
    >
      {text}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent Pill's onClick if also present
            onRemove();
          }}
          className={`ml-1.5 flex-shrink-0 rounded-full p-0.5 ${textColor} hover:bg-black/20 focus:outline-none`}
          aria-label={`Remove ${text}`}
        >
          <svg className="h-3 w-3" stroke="currentColor" fill="none" viewBox="0 0 8 8">
            <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Pill;