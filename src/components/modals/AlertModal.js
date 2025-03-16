import Modal from '../Modal';

/**
 * Alert Modal Component
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to call when the modal is closed
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message
 * @param {string} props.type - Alert type (info, success, warning, error)
 * @param {string} props.confirmText - Text for the confirm button
 * @param {Function} props.onConfirm - Function to call when the confirm button is clicked
 * @param {string} props.cancelText - Text for the cancel button
 * @param {Function} props.onCancel - Function to call when the cancel button is clicked
 * @param {boolean} props.showCancel - Whether to show the cancel button
 */
const AlertModal = ({ 
  isOpen, 
  onClose, 
  title = 'Alert', 
  message, 
  type = 'info',
  confirmText = 'OK',
  onConfirm,
  cancelText = 'Cancel',
  onCancel,
  showCancel = false
}) => {
  // Handle confirm button click
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  // Handle cancel button click
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  // Determine icon and colors based on type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          iconBg: 'bg-green-100',
          iconColor: 'text-green-500',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )
        };
      case 'warning':
        return {
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-500',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )
        };
      case 'error':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-500',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
      case 'info':
      default:
        return {
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-500',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        };
    }
  };

  const { iconBg, iconColor, icon } = getTypeStyles();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
    >
      <div className="text-center mb-6">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${iconBg} ${iconColor} mb-4`}>
          {icon}
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        {message && <p className="text-gray-600">{message}</p>}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        {showCancel && (
          <button
            onClick={handleCancel}
            className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-300"
          >
            {cancelText}
          </button>
        )}
        <button
          onClick={handleConfirm}
          className={`flex-1 py-2 px-4 ${
            type === 'error' 
              ? 'bg-red-500 hover:bg-red-600' 
              : type === 'warning'
                ? 'bg-yellow-500 hover:bg-yellow-600'
                : 'bg-primary hover:bg-primary-dark'
          } text-white rounded-lg transition-colors duration-300`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default AlertModal; 