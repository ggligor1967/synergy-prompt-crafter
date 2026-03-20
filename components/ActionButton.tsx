
import React from 'react';

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
  title?: string; // Added title prop
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  onClick, 
  disabled = false, 
  children, 
  className = '',
  variant = 'primary',
  icon,
  title // Destructure title prop
}) => {
  const baseStyles = "px-4 py-2 rounded-md font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors duration-150 flex items-center justify-center gap-2";
  
  let variantStyles = '';
  switch(variant) {
    case 'primary':
      variantStyles = "bg-sky-600 hover:bg-sky-500 text-white focus:ring-sky-500";
      break;
    case 'secondary':
      variantStyles = "bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-slate-500";
      break;
    case 'danger':
      variantStyles = "bg-red-600 hover:bg-red-500 text-white focus:ring-red-500";
      break;
    case 'ghost':
        variantStyles = "bg-transparent hover:bg-slate-700 text-slate-300 focus:ring-slate-500 border border-slate-600";
        break;
  }

  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles} ${disabledStyles} ${className}`}
      title={title} // Apply title attribute
    >
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </button>
  );
};

export default ActionButton;
