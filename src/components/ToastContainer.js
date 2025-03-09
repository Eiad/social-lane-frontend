import { useState, useEffect, useCallback } from 'react';
import Toast from './Toast';

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  // Function to add a new toast
  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    if (!message) return null;
    
    const id = Date.now().toString();
    setToasts(prevToasts => [...prevToasts, { id, message, type, duration }]);
    return id;
  }, []);

  // Function to remove a toast by id
  const removeToast = useCallback((id) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast?.id !== id));
  }, []);

  // Add methods to window for global access
  useEffect(() => {
    // Create the showToast object if it doesn't exist
    if (typeof window !== 'undefined') {
      window.showToast = {
        success: (message, duration) => addToast(message, 'success', duration),
        error: (message, duration) => addToast(message, 'error', duration),
        info: (message, duration) => addToast(message, 'info', duration),
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.showToast = undefined;
      }
    };
  }, [addToast]);

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-[350px] w-full sm:top-5 sm:right-5 sm:left-auto sm:max-w-[350px] xs:top-2.5 xs:right-2.5 xs:left-2.5 xs:max-w-[calc(100%-20px)]">
      {toasts.map(toast => (
        <Toast
          key={toast?.id}
          message={toast?.message}
          type={toast?.type}
          duration={toast?.duration}
          onClose={() => removeToast(toast?.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer; 