import { useState } from 'react';
import { AlertModal } from '../modals';

/**
 * Example component demonstrating how to use the AlertModal
 */
const AlertModalExample = () => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);

  const handleConfirm = () => {
    setConfirmResult('User confirmed the action');
  };

  const handleCancel = () => {
    setConfirmResult('User cancelled the action');
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Alert Modal Examples</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <button 
          onClick={() => setShowInfoModal(true)}
          className="py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
        >
          Show Info Modal
        </button>
        
        <button 
          onClick={() => setShowSuccessModal(true)}
          className="py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg"
        >
          Show Success Modal
        </button>
        
        <button 
          onClick={() => setShowWarningModal(true)}
          className="py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg"
        >
          Show Warning Modal
        </button>
        
        <button 
          onClick={() => setShowErrorModal(true)}
          className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg"
        >
          Show Error Modal
        </button>
        
        <button 
          onClick={() => setShowConfirmModal(true)}
          className="py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
        >
          Show Confirm Modal
        </button>
      </div>
      
      {confirmResult && (
        <div className="p-4 bg-gray-100 rounded-lg mb-4">
          <p className="font-medium">Confirm Result:</p>
          <p>{confirmResult}</p>
        </div>
      )}
      
      {/* Info Modal */}
      <AlertModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Information"
        message="This is an informational message."
        type="info"
        confirmText="Got it"
      />
      
      {/* Success Modal */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success!"
        message="Your action was completed successfully."
        type="success"
        confirmText="Great!"
      />
      
      {/* Warning Modal */}
      <AlertModal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        title="Warning"
        message="This action might have consequences."
        type="warning"
        confirmText="I understand"
      />
      
      {/* Error Modal */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        message="Something went wrong. Please try again."
        type="error"
        confirmText="Try Again"
      />
      
      {/* Confirm Modal */}
      <AlertModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Action"
        message="Are you sure you want to proceed with this action?"
        type="warning"
        confirmText="Yes, Proceed"
        cancelText="No, Cancel"
        showCancel={true}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default AlertModalExample; 