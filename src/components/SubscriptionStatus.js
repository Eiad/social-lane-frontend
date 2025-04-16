import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { getSubscription, cancelSubscription, checkExpiredSubscriptions } from '../services/subscriptionService';
import { ConfirmCancelSubscriptionModal, SubscriptionCancelledModal } from './modals';

const SubscriptionStatus = ({ onStatusChange }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger re-fetching
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isCancelledButActive, setIsCancelledButActive] = useState(false);
  const [isExpiredButActive, setIsExpiredButActive] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      fetchSubscription(user?.uid);
    }
  }, [user, refreshKey]);

  // Check if subscription is cancelled but still active
  useEffect(() => {
    if (subscription) {
      // Check if subscription is cancelled but the end date is in the future (still active)
      const isCancelled = subscription?.status === 'CANCELLED';
      const now = new Date();
      const endDate = subscription?.subscriptionEndDate ? new Date(subscription.subscriptionEndDate) : null;
      const isEndDateInFuture = endDate && endDate > now;
      
      // Only consider it "cancelled but active" if the end date is in the future
      setIsCancelledButActive(isCancelled && isEndDateInFuture);
      
      // Debug log the full subscription object
      console.log('SubscriptionStatus: Full subscription object:', subscription);
      console.log('SubscriptionStatus: End date is in future:', isEndDateInFuture);
      
      // Check if subscription end date has passed but user still has a paid role
      if (subscription?.subscriptionEndDate && subscription?.status === 'CANCELLED') {
        const isPaidRole = ['Launch', 'Rise', 'Scale'].includes(user?.role);
        
        if (endDate < now && isPaidRole) {
          console.warn('SubscriptionStatus: Subscription end date has passed but user still has paid role');
          setIsExpiredButActive(true);
        } else {
          setIsExpiredButActive(false);
        }
      } else {
        // For active subscriptions, always set this to false
        setIsExpiredButActive(false);
      }
    }
  }, [subscription, user]);

  // Handle keyboard events for modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showConfirmModal) {
          closeCancelModal();
        }
        if (showSuccessModal) {
          closeSuccessModal();
        }
      }
    };

    if (showConfirmModal || showSuccessModal) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent scrolling on the body when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore scrolling when modal is closed
      document.body.style.overflow = 'auto';
    };
  }, [showConfirmModal, showSuccessModal]);

  const fetchSubscription = async (uid) => {
    try {
      console.log(`SubscriptionStatus: Fetching subscription for user ${uid}`);
      setLoading(true);
      const response = await getSubscription(uid);
      if (response?.success) {
        console.log('SubscriptionStatus: Subscription details received:', response?.data);
        console.log('SubscriptionStatus: End date values:', {
          subscriptionEndDate: response?.data?.subscriptionEndDate,
          userSubscriptionEndDate: user?.subscriptionEndDate,
          nextBillingTime: response?.data?.nextBillingTime
        });
        
        // Ensure we have the subscriptionEndDate in the subscription object
        if (response?.data) {
          // If the backend doesn't provide subscriptionEndDate, use nextBillingTime as fallback
          if (!response.data.subscriptionEndDate && response.data.nextBillingTime) {
            response.data.subscriptionEndDate = response.data.nextBillingTime;
            console.log('SubscriptionStatus: Using nextBillingTime as subscriptionEndDate fallback');
          }
        }
        
        setSubscription(response?.data);
        // Call the callback with the fetched status
        if (onStatusChange) {
          onStatusChange(response?.data);
        }
      } else {
        console.error('SubscriptionStatus: Failed to fetch subscription details');
        setError('Failed to fetch subscription details');
        // Indicate no subscription to parent
        if (onStatusChange) {
          onStatusChange({ hasSubscription: false });
        }
      }
    } catch (error) {
      console.error('SubscriptionStatus: Error fetching subscription:', error);
      setError(error?.message || 'Failed to fetch subscription details');
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = () => {
    setShowConfirmModal(true);
  };

  const closeCancelModal = () => {
    setShowConfirmModal(false);
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
  };

  const handleCheckExpiredSubscriptions = async () => {
    try {
      console.log('SubscriptionStatus: Manually checking for expired subscriptions');
      const result = await checkExpiredSubscriptions();
      console.log('SubscriptionStatus: Expired subscription check result:', result);
      
      // Refresh subscription data after check
      setTimeout(() => {
        console.log('SubscriptionStatus: Refreshing subscription data after expiration check');
        setRefreshKey(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('SubscriptionStatus: Error checking expired subscriptions:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.uid || !subscription?.subscriptionId) {
      console.error('SubscriptionStatus: Cannot cancel - missing user ID or subscription ID');
      return;
    }
    
    try {
      console.log(`SubscriptionStatus: Cancelling subscription ${subscription?.subscriptionId} for user ${user?.uid}`);
      setIsCancelling(true);
      
      const response = await cancelSubscription(user?.uid, 'Cancelled by user from account page');
      
      if (response?.success) {
        console.log('SubscriptionStatus: Subscription cancelled successfully');
        
        // Refresh subscription data after a short delay to allow backend to process
        setTimeout(() => {
          console.log('SubscriptionStatus: Refreshing subscription data after cancellation');
          setRefreshKey(prev => prev + 1); // Trigger re-fetch
          closeCancelModal();
          setShowSuccessModal(true);
        }, 2000);
      } else {
        console.error('SubscriptionStatus: Failed to cancel subscription:', response);
        setError('Failed to cancel subscription');
        closeCancelModal();
      }
    } catch (error) {
      console.error('SubscriptionStatus: Error cancelling subscription:', error);
      setError(error?.message || 'Failed to cancel subscription');
      closeCancelModal();
    } finally {
      setIsCancelling(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex justify-center items-center p-6">
        <div className="spinner small"></div>
        <span className="ml-2 text-gray-600">Loading subscription details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        <p>Error: {error}</p>
        <button 
          onClick={() => setRefreshKey(prev => prev + 1)}
          className="mt-2 text-sm underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!subscription?.hasSubscription) {
    return null; // Don't show anything if no subscription
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
        <h3 className="text-xl font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-200">
          Subscription Details
        </h3>
        
        <div className="space-y-3">
          {/* Only show subscription details if we have a subscription */}
          {subscription?.hasSubscription ? (
            <>
              <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                <span className="text-gray-600 font-medium">Status:</span>
                <span className={`font-medium ${
                  subscription?.status === 'ACTIVE' 
                    ? 'text-green-600' 
                    : isCancelledButActive 
                      ? 'text-orange-600'
                      : 'text-yellow-600'
                }`}>
                  {isCancelledButActive ? 'Active (Cancelled)' : subscription?.status}
                </span>
              </div>
              
              {/* Show subscription ID */}
              <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                <span className="text-gray-600 font-medium">Subscription ID:</span>
                <span className="text-gray-800 font-mono text-sm break-all">{subscription?.subscriptionId}</span>
              </div>
              
              {/* Show plan tier/role */}
              <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                <span className="text-gray-600 font-medium">Plan:</span>
                <span className="text-gray-800">{subscription?.planTier || subscription?.role || 'Starter'}</span>
              </div>
              
              {/* Only show cancellation info if the subscription is cancelled but still active */}
              {isCancelledButActive && (
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200 bg-yellow-50">
                  <span className="text-orange-600 font-medium">Access until:</span>
                  <span className="text-orange-600 font-medium">{formatDate(subscription?.subscriptionEndDate)}</span>
                </div>
              )}
              
              {/* Show next billing info if active and not cancelled */}
              {!isCancelledButActive && subscription?.status === 'ACTIVE' && subscription?.nextBillingTime && (
                <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                  <span className="text-gray-600 font-medium">Next billing:</span>
                  <span className="text-gray-800">{formatDate(subscription?.nextBillingTime)}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 italic">You are currently on the Starter plan with basic features.</p>
          )}
          
          {/* Refresh button for debugging */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
      
      {/* Confirm Cancel Modal */}
      {showConfirmModal && (
        <ConfirmCancelSubscriptionModal
          onCancel={closeCancelModal}
          onConfirm={handleCancelSubscription}
          endDate={subscription?.subscriptionEndDate}
          isProcessing={isCancelling}
        />
      )}
      
      {/* Success Modal */}
      {showSuccessModal && (
        <SubscriptionCancelledModal
          onClose={closeSuccessModal}
          endDate={subscription?.subscriptionEndDate}
        />
      )}
    </>
  );
};

export default SubscriptionStatus; 