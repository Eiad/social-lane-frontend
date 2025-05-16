import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { getSubscription, cancelSubscription, checkExpiredSubscriptions } from '../services/subscriptionService';
import { ConfirmCancelSubscriptionModal, SubscriptionCancelledModal } from './modals';
import { InformationCircleIcon, ExclamationTriangleIcon, CogIcon, CreditCardIcon, CalendarDaysIcon, PlayIcon, StopIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-50';
      case 'CANCELLED':
        return isCancelledButActive ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';
      case 'SUSPENDED':
        return 'text-red-600 bg-red-50';
      case 'APPROVAL_PENDING':
      case 'PENDING':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const DetailRow = ({ icon: IconComponent, label, value, valueClassName = 'text-gray-800 font-medium', show = true }) => {
    if (!show) return null;
    return (
      <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
        <div className="flex items-center text-sm text-gray-600">
          <IconComponent className="h-5 w-5 mr-3 text-gray-400" />
          <span>{label}</span>
        </div>
        <span className={`text-sm ${valueClassName}`}>{value}</span>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-1">
        <DetailRow 
          icon={subscription?.status === 'ACTIVE' ? CheckCircleIcon : 
                subscription?.status === 'CANCELLED' && isCancelledButActive ? ExclamationTriangleIcon :
                subscription?.status === 'CANCELLED' ? XCircleIcon :
                InformationCircleIcon}
          label="Status:"
          value={subscription?.status ? subscription.status.replace('_', ' ') : 'N/A'}
          valueClassName={`px-2.5 py-0.5 rounded-full font-semibold text-xs uppercase tracking-wider ${getStatusColor(subscription?.status)}`}
        />
        <DetailRow
          icon={PlayIcon}
          label="Plan:"
          value={subscription?.planTier || user?.role || 'N/A'}
          valueClassName="text-gray-800 font-semibold"
        />
        <DetailRow
          icon={CreditCardIcon}
          label="Subscription ID:"
          value={subscription?.subscriptionId || 'N/A'}
          valueClassName="text-gray-700 font-mono text-xs"
          show={subscription?.status === 'ACTIVE' || isCancelledButActive}
        />
        
        {isCancelledButActive ? (
          <DetailRow
            icon={StopIcon}
            label="Access Ends:"
            value={formatDate(subscription?.subscriptionEndDate)}
            valueClassName="text-yellow-700 font-semibold"
          />
        ) : subscription?.status === 'ACTIVE' && subscription?.nextBillingTime ? (
          <DetailRow
            icon={CalendarDaysIcon}
            label="Renews on:"
            value={formatDate(subscription?.nextBillingTime)}
            valueClassName="text-gray-800 font-semibold"
          />
        ) : null}

      </div>
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setRefreshKey(prev => prev + 1)}
          className="text-xs text-primary hover:text-primary-dark font-medium flex items-center"
          title="Refresh subscription status"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Refresh Status
        </button>
      </div>

      {isExpiredButActive && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <p className="font-medium">Your subscription period has ended.</p>
          <p>Please update your subscription or your account may be downgraded.</p>
          <button 
            onClick={handleCheckExpiredSubscriptions} 
            className="mt-2 text-red-600 underline hover:text-red-800 font-semibold">
            Check My Account Status
          </button>
        </div>
      )}

      {showConfirmModal && (
        <ConfirmCancelSubscriptionModal
          isOpen={showConfirmModal}
          onClose={closeCancelModal}
          onConfirm={handleCancelSubscription}
          isCancelling={isCancelling}
          subscriptionEndDate={subscription?.subscriptionEndDate ? formatDate(subscription.subscriptionEndDate) : null}
        />
      )}
      {showSuccessModal && (
        <SubscriptionCancelledModal
          isOpen={showSuccessModal}
          onClose={closeSuccessModal}
          subscriptionEndDate={subscription?.subscriptionEndDate ? formatDate(subscription.subscriptionEndDate) : null}
        />
      )}
    </>
  );
};

export default SubscriptionStatus; 