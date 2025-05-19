import React from 'react';

const Switch = ({ checked, onChange, disabled = false, id, name, className = '', label = '' }) => {
  const handleChange = (e) => {
    if (disabled) return;
    onChange?.(e.target.checked);
  };

  return (
    <div className={`flex items-center ${className}`}>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          id={id}
          name={name}
        />
        <div className={`
          relative w-16 h-8 rounded-full transition-all duration-300 ease-in-out
          ${checked 
            ? 'bg-green-500' 
            : 'bg-gray-300 dark:bg-gray-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}>
          <div className={`
            absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-all duration-300 ease-in-out flex items-center justify-center
            ${checked ? 'translate-x-8' : ''}
          `}>
          </div>
        </div>
      </label>
      {label && (
        <label 
          htmlFor={id} 
          className={`ml-3 text-md font-semibold text-gray-800 dark:text-gray-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {label}
        </label>
      )}
    </div>
  );
};

export default Switch; 