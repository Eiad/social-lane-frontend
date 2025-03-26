import React, { createContext, useContext, useState } from 'react';
import GlobalLoader from '../components/GlobalLoader';

// Create context
const LoaderContext = createContext({
  showLoader: () => {},
  hideLoader: () => {},
  isLoading: false,
  setLoaderMessage: () => {},
});

// Context provider
export const LoaderProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Processing...');

  const showLoader = (customMessage = 'Processing...') => {
    setMessage(customMessage);
    setIsLoading(true);
  };

  const hideLoader = () => {
    setIsLoading(false);
  };

  const setLoaderMessage = (newMessage) => {
    setMessage(newMessage);
  };

  return (
    <LoaderContext.Provider
      value={{
        showLoader,
        hideLoader,
        isLoading,
        setLoaderMessage,
      }}
    >
      {children}
      <GlobalLoader isVisible={isLoading} message={message} />
    </LoaderContext.Provider>
  );
};

// Custom hook to use the loader
export const useLoader = () => useContext(LoaderContext);

export default LoaderContext; 