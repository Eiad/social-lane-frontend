import { useEffect } from 'react';

/**
 * Global Modal Component
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to call when the modal is closed
 * @param {React.ReactNode} props.children - Content to display in the modal
 * @param {string} props.title - Modal title
 * @param {string} props.size - Modal size (sm, md, lg, xl)
 * @param {boolean} props.closeOnClickOutside - Whether to close the modal when clicking outside
 * @param {boolean} props.closeOnEsc - Whether to close the modal when pressing Escape
 * @param {string} props.className - Additional class names for the modal content
 */
const Modal = ({ 
  isOpen, 
  onClose, 
  children, 
  title, 
  size = 'md',
  closeOnClickOutside = true,
  closeOnEsc = true,
  className = ''
}) => {
  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (closeOnEsc && e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent scrolling on the body when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore scrolling when modal is closed
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose, closeOnEsc]);

  if (!isOpen) return null;

  // Determine modal width based on size prop
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-full'
  };

  const modalSizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto"
      onClick={closeOnClickOutside ? onClose : undefined}
      aria-modal="true"
      role="dialog"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div 
        className={`bg-white rounded-xl shadow-xl ${modalSizeClass} w-full p-6 relative animate-scale-in mx-auto my-8 ${className}`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {title && (
          <h3 id="modal-title" className="text-xl font-bold text-gray-900 mb-4">
            {title}
          </h3>
        )}
        
        {children}
      </div>
    </div>
  );
};

export default Modal; 