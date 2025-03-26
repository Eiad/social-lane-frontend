import React from 'react';
import { createPortal } from 'react-dom';

const GlobalLoader = ({ isVisible = false, message = 'Processing...' }) => {
  // Only render on client-side
  if (typeof document === 'undefined' || !isVisible) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm transition-all duration-300">
      <div className="bg-white bg-opacity-10 rounded-2xl p-8 flex flex-col items-center max-w-md mx-auto border border-white border-opacity-20 shadow-xl">
        <div className="relative w-20 h-20 mb-4">
          {/* Spinner rings */}
          <div className="absolute inset-0 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
          <div className="absolute inset-1 border-t-4 border-pink-500 border-solid rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
          <div className="absolute inset-2 border-t-4 border-purple-500 border-solid rounded-full animate-spin" style={{ animationDuration: '2s' }}></div>
          
          {/* Center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          </div>
        </div>
        
        <h3 className="text-white text-xl font-semibold mb-2">
          {message}
        </h3>
        
        <div className="flex space-x-1 mt-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GlobalLoader; 