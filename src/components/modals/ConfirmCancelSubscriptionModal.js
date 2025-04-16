import Modal from '../Modal';

/**
 * Modal for confirming subscription cancellation
 */
const ConfirmCancelSubscriptionModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  nextBillingDate,
  isProcessing
}) => {
  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return 'your current billing period ends';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.error('ConfirmCancelSubscriptionModal: Invalid date passed to formatDate:', dateString);
      return 'your current billing period ends';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Cancel Subscription</h3>
        <p className="text-gray-600">
          Are you sure you want to cancel your subscription? 
        </p>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-gray-700">
              You will continue to have Pro access until <span className="font-semibold">{formatDate(nextBillingDate)}</span>. After this date, your account will revert to the Free plan.
            </p>
            <p className="text-sm text-gray-700 mt-2">
              You can resubscribe at any time to regain Pro access.
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors duration-300"
          disabled={isProcessing}
        >
          Keep Subscription
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <span className="spinner small mr-2"></span>
              Cancelling...
            </>
          ) : (
            'Yes, Cancel'
          )}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmCancelSubscriptionModal; 