import Modal from '../Modal';

/**
 * Modal for displaying subscription cancellation success
 */
const SubscriptionCancelledModal = ({ 
  isOpen, 
  onClose, 
  nextBillingDate,
  subscriptionEndDate
}) => {
  // Debug log the date values
  console.log('SubscriptionCancelledModal: Date values:', {
    nextBillingDate,
    subscriptionEndDate,
    formattedEndDate: subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString() : 'N/A'
  });

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return 'N/A';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  // Use subscriptionEndDate if available, otherwise fall back to nextBillingDate
  const endDate = subscriptionEndDate || nextBillingDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Subscription Cancelled</h3>
        <p className="text-gray-600">
          Your subscription has been cancelled successfully.
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-6">
        <div className="flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Important:</span> You will continue to have Pro access until <span className="font-semibold">{formatDate(endDate)}</span>.
            </p>
            <p className="text-sm text-gray-700 mt-2">
              Your PayPal account will not be charged again. You can resubscribe at any time.
            </p>
          </div>
        </div>
      </div>
      
      <button
        onClick={onClose}
        className="w-full py-2 px-4 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors duration-300"
      >
        Got it
      </button>
    </Modal>
  );
};

export default SubscriptionCancelledModal; 