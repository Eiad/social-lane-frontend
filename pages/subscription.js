import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../src/context/AuthContext';
import { getSubscription, createSubscription, cancelSubscription } from '../src/services/subscriptionService';
import ProtectedRoute from '../src/components/ProtectedRoute';
import { CheckIcon } from '@heroicons/react/24/solid';

const Subscription = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { status, uid, message } = router.query;
  const [subscriptionStatus, setSubscriptionStatus] = useState('loading');
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger re-fetching
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // monthly or yearly
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [showConfirmCancelModal, setShowConfirmCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelSuccessModal, setShowCancelSuccessModal] = useState(false);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      console.log('Subscription: User not authenticated, redirecting to login');
      router.push('/my-account');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Handle subscription status from query parameters
    if (status && uid) {
      console.log(`Subscription: Handling status from query: ${status} for user ${uid}`);
      
      if (status === 'success') {
        console.log('Subscription: Success status detected, fetching subscription details');
        setSubscriptionStatus('success');
        // Fetch updated subscription details
        fetchSubscriptionDetails(uid);
      } else if (status === 'cancelled') {
        console.log('Subscription: Cancelled status detected');
        setSubscriptionStatus('cancelled');
      } else if (status === 'error') {
        console.log(`Subscription: Error status detected: ${message}`);
        setSubscriptionStatus('error');
        setError(message || 'An error occurred with your subscription');
      }
    } else if (user?.uid) {
      // If no status in query but user is logged in, fetch subscription details
      console.log('Subscription: No status in query, fetching subscription details for logged in user');
      fetchSubscriptionDetails(user?.uid);
    }

    // Check for the action query parameter
    if (router.query.action === 'cancel' && 
        user?.role !== 'Starter' && 
        !isCancelling && 
        subscriptionDetails?.status !== 'CANCELLED') {
      console.log('URL action=cancel detected, opening confirmation modal.');
      openConfirmCancelModal();
    }
  }, [status, uid, message, user, router.query.action, subscriptionDetails?.status, isCancelling]);

  const fetchSubscriptionDetails = async (userId) => {
    try {
      console.log(`Subscription: Fetching subscription details for user ${userId}`);
      const response = await getSubscription(userId);
      
      if (response?.success) {
        console.log('Subscription: Subscription details received:', response?.data);
        setSubscriptionDetails(response?.data);
        
        if (response?.data?.hasSubscription) {
          // If we have a subscription, set the status based on the PayPal status
          console.log(`Subscription: Setting status based on PayPal status: ${response?.data?.status}`);
          
          if (response?.data?.status === 'ACTIVE') {
            setSubscriptionStatus('active');
          } else if (response?.data?.status === 'CANCELLED' || response?.data?.status === 'EXPIRED') {
            setSubscriptionStatus('cancelled');
          } else if (response?.data?.status === 'SUSPENDED') {
            setSubscriptionStatus('suspended');
          } else {
            setSubscriptionStatus('pending');
          }
        } else {
          console.log('Subscription: User has no subscription');
          setSubscriptionStatus('inactive');
        }
      } else {
        console.error('Subscription: Failed to fetch subscription details');
        setError('Failed to fetch subscription details');
        setSubscriptionStatus('error');
      }
    } catch (error) {
      console.error('Subscription: Error fetching subscription:', error);
      setError(error?.message || 'Failed to fetch subscription details');
      setSubscriptionStatus('error');
    }
  };

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Handle subscription creation
  const handleCreateSubscription = async (planTier) => {
    if (!user?.uid) return;
    
    try {
      setIsCreatingSubscription(true);
      const response = await createSubscription(user.uid, planTier);
      
      if (response?.success && response?.data?.approvalUrl) {
        window.location.href = response.data.approvalUrl;
      } else {
        setError('Failed to create subscription');
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      setError(error?.message || 'Failed to create subscription');
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  // Define subscription plans
  const plans = [
    {
      name: 'Launch',
      description: 'Best for beginner creators',
      monthlyPrice: 9,
      yearlyPrice: 90, // 25% off yearly
      features: [
        '5 connected social accounts',
        'Unlimited posts',
        'Schedule posts',
        'Carousel posts',
      ],
      popular: false,
      tier: 'Launch',
      action: () => handleCreateSubscription('Launch'),
      color: 'white'
    },
    {
      name: 'Rise',
      description: 'Best for growing creators',
      monthlyPrice: 18,
      yearlyPrice: 180, // 25% off yearly
      features: [
        '15 connected social accounts',
        'Unlimited posts',
        'Schedule posts',
        'Carousel posts',
        'Content studio access',
        'Limited growth consulting',
      ],
      popular: true,
      tier: 'Rise',
      action: () => handleCreateSubscription('Rise'),
      color: 'white'
    },
    {
      name: 'Scale',
      description: 'Best for scaling brands',
      monthlyPrice: 27,
      yearlyPrice: 270, // 25% off yearly
      features: [
        'Unlimited connected accounts',
        'Unlimited posts',
        'Schedule posts',
        'Carousel posts',
        'Content studio access',
        'Priority growth consulting',
      ],
      popular: false,
      tier: 'Scale',
      action: () => handleCreateSubscription('Scale'),
      color: 'white'
    }
  ];

  // Check if a plan is the current plan
  const isCurrentPlan = (tier) => {
    // If subscription is cancelled and the end date has passed, user should be on Starter plan
    if (subscriptionDetails?.status === 'CANCELLED' && subscriptionDetails?.subscriptionEndDate) {
      const endDate = new Date(subscriptionDetails.subscriptionEndDate);
      const now = new Date();
      if (endDate <= now) {
        return tier === 'Starter'; // User should be on Starter plan
      }
    }
    
    return subscriptionDetails?.planTier === tier || 
          (subscriptionDetails?.role === tier && subscriptionDetails?.status === 'ACTIVE');
  };

  const renderPlanTabs = () => (
    <div className="flex justify-center mb-10">
      <div className="border border-gray-300 rounded-full inline-flex p-1 bg-slate-800 text-white relative">
        {billingPeriod === 'yearly' && (
          <div className="absolute -right-6 -top-6 bg-purple-600 text-white text-xs font-semibold py-1 px-2 rounded-full transform rotate-12 shadow-lg">
            40% OFF
          </div>
        )}
        <button
          className={`px-8 py-3 rounded-full transition-all font-medium ${
            billingPeriod === 'monthly' 
              ? 'bg-green-500 text-white'
              : 'bg-transparent text-white'
          }`}
          onClick={() => setBillingPeriod('monthly')}
        >
          Monthly
        </button>
        <button
          className={`px-8 py-3 rounded-full transition-all font-medium ${
            billingPeriod === 'yearly' 
              ? 'bg-green-500 text-white'
              : 'bg-transparent text-white'
          }`}
          onClick={() => setBillingPeriod('yearly')}
        >
          Yearly
        </button>
      </div>
    </div>
  );

  const renderPlans = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {plans.map((plan, index) => {
        const isCurrentUserPlan = isCurrentPlan(plan.tier);
        const isCurrentPlanCancelled = isCurrentUserPlan && subscriptionDetails?.status === 'CANCELLED';
        
        // Check if cancellation date is in the future
        const subscriptionEndDate = subscriptionDetails?.subscriptionEndDate 
          ? new Date(subscriptionDetails.subscriptionEndDate) 
          : null;
        const now = new Date();
        const isCancellationInFuture = subscriptionEndDate && subscriptionEndDate > now;
        
        // If subscription end date has passed, user shouldn't have this plan anymore
        // This is a safeguard in case backend didn't downgrade user properly
        if (isCurrentPlanCancelled && subscriptionEndDate && subscriptionEndDate <= now) {
          return null; // Don't show this plan, user should see Starter plan instead
        }
        
        return (
          <div 
            key={plan.name}
            className={`relative bg-slate-800 text-white rounded-xl overflow-hidden ${
              isCurrentUserPlan ? 'border-4 border-green-500 transform md:scale-105 z-10' : 
              plan.popular ? 'border-2 border-green-500 transform md:scale-105 z-10' : 
              'border border-gray-700'
            }`}
          >
            {isCurrentUserPlan && (
              <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-sm font-bold py-1 px-0 text-center">
                Current Plan
              </div>
            )}
            
            {isCurrentPlanCancelled && isCancellationInFuture && (
              <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white text-sm font-bold py-1 px-0 text-center">
                Cancels on {formatDate(subscriptionDetails?.subscriptionEndDate)}
              </div>
            )}
            
            {!isCurrentUserPlan && plan.popular && (
              <div className="absolute top-5 right-5 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Most popular
              </div>
            )}
            
            {!isCurrentUserPlan && plan.name === 'Scale' && (
              <div className="absolute top-5 right-5 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Best deal
              </div>
            )}
            
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
              <p className="text-gray-400 text-sm">{plan.description}</p>
              
              <div className="mt-6 mb-8">
                <span className="text-5xl font-bold text-white">${billingPeriod === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)}</span>
                <span className="text-gray-400 ml-2">/month</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
              
              {isCurrentUserPlan ? (
                <div>
                  {isCurrentPlanCancelled && isCancellationInFuture ? (
                    <div className="bg-orange-600 text-white py-3 px-6 rounded-lg font-medium text-center">
                      Plan ends on {formatDate(subscriptionDetails?.subscriptionEndDate)}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowConfirmCancelModal(true)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
                    >
                      Cancel Plan
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleCreateSubscription(plan.tier)}
                  disabled={isCreatingSubscription}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreatingSubscription ? 'Processing...' : 'Get started →'}
                </button>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-900 border-t border-gray-700">
              <p className="text-gray-400 text-sm text-center">7 day money-back guarantee</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSupportedPlatforms = () => (
    <div className="mt-16 text-center">
      <p className="text-gray-500 mb-4">Post to:</p>
      <div className="flex flex-wrap justify-center gap-4">
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" fill="#1DA1F2"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="#E1306C"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z" fill="#0077B5"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" fill="#1877F2"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 448 512"><path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z" fill="#000000"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" fill="#FF0000"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M9.417 15.181l-.397 5.584c.568 0 .814-.244 1.109-.537l2.663-2.545 5.518 4.041c1.012.564 1.725.267 1.998-.931l3.622-16.972.001-.001c.321-1.496-.541-2.081-1.527-1.714l-21.29 8.151c-1.453.564-1.431 1.374-.247 1.741l5.443 1.693 12.643-7.911c.595-.394 1.136-.176.691.218z" fill="#229ED9"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M24 11.7c0 6.45-5.27 11.68-11.78 11.68-2.07 0-4-.53-5.7-1.45L0 24l2.13-6.27a11.57 11.57 0 0 1-1.7-6.04C.44 5.23 5.72 0 12.23 0 18.72 0 24 5.23 24 11.7M12.22 1.85c-5.46 0-9.9 4.41-9.9 9.83 0 2.15.7 4.14 1.88 5.76L2.96 21.1l3.8-1.2a9.9 9.9 0 0 0 5.46 1.62c5.46 0 9.9-4.4 9.9-9.83a9.88 9.88 0 0 0-9.9-9.83m5.95 12.52c-.08-.12-.27-.19-.56-.33-.28-.14-1.7-.84-1.97-.93-.26-.1-.46-.15-.65.14-.2.29-.75.93-.91 1.12-.17.2-.34.22-.63.08-.29-.15-1.22-.45-2.32-1.43a8.64 8.64 0 0 1-1.6-1.98c-.18-.29-.03-.44.12-.58.13-.13.29-.34.43-.5.15-.17.2-.3.29-.48.1-.2.05-.36-.02-.5-.08-.15-.65-1.56-.9-2.13-.24-.58-.48-.48-.64-.48-.17 0-.37-.03-.56-.03-.2 0-.5.08-.77.36-.26.29-1 .98-1 2.4 0 1.4 1.03 2.76 1.17 2.96.14.19 2 3.17 4.93 4.32 2.94 1.15 2.94.77 3.47.72.53-.05 1.7-.7 1.95-1.36.24-.67.24-1.25.17-1.37" fill="#25D366"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M21 12c0 4.971-4.029 9-9 9s-9-4.029-9-9 4.029-9 9-9 9 4.029 9 9z" fill="#1CA2E2"/><path d="M12 10c-.414 0-.75.336-.75.75v6.5c0 .414.336.75.75.75s.75-.336.75-.75v-6.5c0-.414-.336-.75-.75-.75z" fill="#FFFFFF"/><path d="M12 5c-.414 0-.75.336-.75.75v1.5c0 .414.336.75.75.75s.75-.336.75-.75v-1.5c0-.414-.336-.75-.75-.75z" fill="#FFFFFF"/></svg>
        </div>
        <div className="p-2 rounded-full bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm4.441 16.892c-2.102.144-6.784.144-8.883 0-2.276-.156-2.541-1.27-2.558-4.892.017-3.629.285-4.736 2.558-4.892 2.099-.144 6.782-.144 8.883 0 2.277.156 2.541 1.27 2.559 4.892-.018 3.629-.285 4.736-2.559 4.892zm-6.441-7.234l4.917 2.338-4.917 2.346v-4.684z" fill="#FF0000"/></svg>
        </div>
      </div>
    </div>
  );

  // Add these functions to handle subscription cancellation:

  // Function to open the confirmation modal
  // Ensures we have the latest subscription details (including end date) first
  const openConfirmCancelModal = async () => {
    if (!user?.uid) {
      setError('User not found. Cannot proceed with cancellation.');
      return;
    }
    
    // Ensure we have the latest details, especially the end date
    // Set status to loading to show feedback
    setSubscriptionStatus('loading');
    try {
      await fetchSubscriptionDetails(user.uid); // Fetch latest details
    } catch (fetchError) {
      setError('Could not fetch latest subscription details. Please try again.');
      setSubscriptionStatus('error'); // Show error if fetch fails
      return;
    }
    
    // Once details are fetched, show the modal
    setShowConfirmCancelModal(true);
  };

  const handleCancelSubscription = async () => {
    if (!user?.uid || !subscriptionDetails?.subscriptionId) {
      setError('Unable to cancel subscription. Missing required information.');
      setShowConfirmCancelModal(false);
      return;
    }
    
    // Remove action=cancel from URL immediately
    console.log('handleCancelSubscription started, removing action=cancel from URL.');
    closeCancelModal();
    
    // Keep the button disabled and showing spinner
    setIsCancelling(true);
    
    try {
      // Call the backend API
      const response = await cancelSubscription(user?.uid);
      
      // Important: Only proceed on successful response
      if (response?.success) {
        // Update the local state *before* showing success modal for consistent date display
        setSubscriptionDetails(prev => ({
          ...prev,
          status: 'CANCELLED',
          // Use the end date returned from the API response if available, else keep existing
          subscriptionEndDate: response?.subscriptionEndDate || prev?.subscriptionEndDate
        }));
        
        // Close the confirmation modal *first*
        setShowConfirmCancelModal(false);
        // Then show the success modal
        setShowCancelSuccessModal(true);
        
        // No need for setTimeout or refreshKey here, rely on closing the success modal
        
      } else {
        // Handle API error - keep confirmation modal open or close and show error banner
        setError(response?.message || 'Failed to cancel subscription. Please try again or contact support.');
        setShowConfirmCancelModal(false); // Close confirm modal on error
        // Let the error banner display
        setSubscriptionStatus('error');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      setError(error?.message || 'Failed to cancel subscription');
      setShowConfirmCancelModal(false); // Close confirm modal on error
      setSubscriptionStatus('error');
    } finally {
      // Re-enable button only after everything is done (success or error handled)
      setIsCancelling(false);
    }
  };

  const closeCancelModal = () => {
    setShowConfirmCancelModal(false);
    // Remove action=cancel from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('action');
    window.history.replaceState({}, '', url);
  };

  // Refresh data when the success modal is closed
  const closeCancelSuccessModal = () => {
    setShowCancelSuccessModal(false);
    setRefreshKey(prev => prev + 1); // Trigger refresh *after* success is acknowledged
  };

  // Now, let's render the appropriate view based on subscription status
  return (
    <>
      <Head>
        <title>Subscription Plans | Social Lane</title>
        <meta name="description" content="Choose your Social Lane subscription plan" />
      </Head>

      <div className="min-h-screen bg-slate-900 text-white">
        <div className="pt-6 px-4 sm:px-6 transition-all duration-300">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold text-center text-white mb-8 mt-8">Choose your plan</h1>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="spinner"></div>
                <p className="mt-4 text-gray-400">Loading...</p>
              </div>
            ) : user ? (
              subscriptionStatus === 'loading' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="spinner"></div>
                  <p className="mt-4 text-gray-400">Loading subscription details...</p>
                </div>
              ) : (
                <div>
                  {/* Show subscription plans by default */}
                  {renderPlanTabs()}
                  {renderPlans()}
                  {renderSupportedPlatforms()}
                  
                  {/* Show active subscription details when user has an active subscription */}
                  {subscriptionStatus === 'active' && subscriptionDetails && (
                    <div className="mt-16 bg-slate-800 rounded-xl p-6 max-w-2xl mx-auto">
                      <h2 className="text-2xl font-bold text-white mb-4">Your Active Subscription</h2>
                      <div className="bg-slate-700 p-4 rounded-lg mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-300">Status:</span>
                          <span className="text-green-400 font-medium">{subscriptionDetails?.status}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-300">Plan:</span>
                          <span className="text-white font-medium">{subscriptionDetails?.planTier || subscriptionDetails?.role}</span>
                        </div>
                        {subscriptionDetails?.nextBillingTime && (
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300">Next Billing:</span>
                            <span className="text-white">{formatDate(subscriptionDetails?.nextBillingTime)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-center mt-4">
                        <button
                          onClick={() => router.push('/my-account')}
                          className="bg-green-500 hover:bg-green-600 text-white py-2 px-6 rounded-lg transition-colors duration-300"
                        >
                          Manage Subscription
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Show error message when there's an error */}
                  {subscriptionStatus === 'error' && (
                    <div className="mt-8 bg-red-500/20 border border-red-500/30 p-4 rounded-lg max-w-2xl mx-auto">
                      <h3 className="text-xl font-semibold text-white mb-2">Subscription Error</h3>
                      <p className="text-red-200 mb-4">{error || 'There was an error processing your subscription.'}</p>
                      <button
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="bg-slate-800 rounded-xl p-8 shadow-lg max-w-md mx-auto text-center transition-all duration-300 animate-scale-in">
                <p className="text-gray-300 mb-6">Please sign in to access subscription features.</p>
                <Link href="/my-account" className="inline-flex items-center justify-center bg-green-500 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-600 transition-colors duration-300">
                  Go to Sign In
                </Link>
              </div>
            )}
          </div>
          
          <div className="mt-16 pb-8"></div>
        </div>
      </div>
      
      {/* Confirm Cancellation Modal */}
      {showConfirmCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-auto animate-scale-in text-gray-800">
            <h3 className="text-xl font-bold mb-4">Cancel Your Subscription?</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to cancel your subscription? You will still have access to all features until your current billing period ends.
            </p>
            
            {subscriptionDetails?.subscriptionEndDate && (
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-800">
                <p className="font-medium">Your subscription will remain active until {formatDate(subscriptionDetails?.subscriptionEndDate) || 'your current billing period ends'}</p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={closeCancelModal}
                className="py-2 px-4 border border-gray-300 rounded-lg font-medium"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isCancelling}
                className="py-2 px-4 bg-red-600 text-white rounded-lg font-medium disabled:opacity-70"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Cancel Success Modal */}
      {showCancelSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-auto animate-scale-in text-gray-800">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2 text-center">Subscription Cancelled</h3>
            <p className="mb-6 text-gray-600 text-center">
              Your subscription has been successfully cancelled. You will continue to have access to all premium features until {formatDate(subscriptionDetails?.subscriptionEndDate)}.
            </p>
            <button
              onClick={closeCancelSuccessModal}
              className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default function SubscriptionPage() {
  return (
    <ProtectedRoute>
      <Subscription />
    </ProtectedRoute>
  );
} 