
import React from 'react';

const LoadingSpinner: React.FC<{ size?: string }> = ({ size = "w-8 h-8" }) => {
  return (
    <div className={`animate-spin rounded-full border-4 border-slate-500 border-t-sky-500 ${size}`} role="status">
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;
