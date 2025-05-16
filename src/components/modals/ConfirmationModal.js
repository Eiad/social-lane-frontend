import React from 'react';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  confirmButtonClassName = 'bg-primary hover:bg-primary-dark text-white', // Default to primary button
  icon // Optional JSX for an icon
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden flex items-center justify-center" aria-modal="true" role="dialog">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 my-8 z-10 transform transition-all">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start">
            {icon && (
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-opacity-20 sm:mx-0 sm:h-10 sm:w-10">
                {icon}
              </div>
            )}
            <div className={`mt-3 text-center sm:mt-0 ${icon ? 'sm:ml-4' : 'sm:ml-0'} sm:text-left w-full`}>
              <h3 className="text-lg leading-6 font-semibold text-slate-900 dark:text-slate-100" id="modal-title">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {message}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-4 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-xl">
          <button
            type="button"
            className={`w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm transition-colors duration-200 dark:focus:ring-offset-slate-800 ${confirmButtonClassName}`}
            onClick={onConfirm}
          >
            {confirmButtonText}
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-primary-light sm:mt-0 sm:w-auto sm:text-sm transition-colors duration-200 dark:focus:ring-offset-slate-800"
            onClick={onClose}
          >
            {cancelButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal; 