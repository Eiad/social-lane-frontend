import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../src/context/AuthContext';
import Navigation from '../src/components/Navigation';
import { getSubscription } from '../src/services/subscriptionService';

const Subscription = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { status, uid, message } = router.query;
  const [subscriptionStatus, setSubscriptionStatus] = useState('loading');
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger re-fetching

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
  }, [status, uid, message, user, refreshKey]);

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

  return (
    <>
      <Head>
        <title>Subscription | Social Lane</title>
        <meta name="description" content="Manage your Social Lane subscription" />
      </Head>

      <div className="min-h-screen bg-background">
        <Navigation />
        
        <div className="md:ml-64 pt-6 px-4 sm:px-6 transition-all duration-300">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-8 animate-slide-down">Subscription</h1>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="spinner"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            ) : user ? (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 sm:p-8 shadow-lg transition-all duration-500 animate-fade-in">
                {subscriptionStatus === 'loading' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="spinner"></div>
                    <p className="mt-4 text-gray-600">Loading subscription details...</p>
                  </div>
                )}

                {subscriptionStatus === 'success' && (
                  <div className="text-center mb-8">
                    <div className="bg-green-100 text-green-800 p-4 rounded-lg mb-6 inline-flex items-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>Your subscription has been activated successfully!</span>
                    </div>
                    <p className="text-gray-700">
                      Thank you for subscribing to Social Lane Pro. You now have access to all premium features.
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/my-account" className="inline-flex items-center justify-center bg-primary text-white font-medium py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors duration-300">
                        Go to My Account
                      </Link>
                      <button 
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        className="inline-flex items-center justify-center bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-300"
                      >
                        Refresh Status
                      </button>
                    </div>
                  </div>
                )}

                {subscriptionStatus === 'cancelled' && (
                  <div className="text-center mb-8">
                    <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-6 inline-flex items-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                      <span>Subscription process was cancelled</span>
                    </div>
                    <p className="text-gray-700">
                      You&apos;ve cancelled the subscription process. You can try again anytime.
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/my-account" className="inline-flex items-center justify-center bg-primary text-white font-medium py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors duration-300">
                        Go to My Account
                      </Link>
                      <button 
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        className="inline-flex items-center justify-center bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-300"
                      >
                        Refresh Status
                      </button>
                    </div>
                  </div>
                )}

                {subscriptionStatus === 'error' && (
                  <div className="text-center mb-8">
                    <div className="bg-red-100 text-red-800 p-4 rounded-lg mb-6 inline-flex items-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>Error with subscription</span>
                    </div>
                    <p className="text-gray-700">
                      {error || 'There was an error processing your subscription. Please try again later.'}
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/my-account" className="inline-flex items-center justify-center bg-primary text-white font-medium py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors duration-300">
                        Go to My Account
                      </Link>
                      <button 
                        onClick={() => setRefreshKey(prev => prev + 1)}
                        className="inline-flex items-center justify-center bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-300"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {subscriptionStatus === 'active' && subscriptionDetails && (
                  <div className="mb-8">
                    <div className="bg-primary/10 border border-primary/20 p-6 rounded-lg mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 mb-4">Active Subscription</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <p className="text-gray-600 font-medium">Status</p>
                          <p className="text-gray-900 font-bold">{subscriptionDetails?.status}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <p className="text-gray-600 font-medium">Plan</p>
                          <p className="text-gray-900 font-bold">Pro</p>
                        </div>
                        {subscriptionDetails?.nextBillingTime && (
                          <div className="bg-white p-4 rounded-lg shadow-sm">
                            <p className="text-gray-600 font-medium">Next Billing Date</p>
                            <p className="text-gray-900 font-bold">{formatDate(subscriptionDetails?.nextBillingTime)}</p>
                          </div>
                        )}
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <p className="text-gray-600 font-medium">Subscription ID</p>
                          <p className="text-gray-900 text-sm break-all">{subscriptionDetails?.subscriptionId}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                        <button 
                          onClick={() => router.push('/my-account')}
                          className="inline-flex items-center justify-center bg-primary text-white font-medium py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors duration-300"
                        >
                          Go to My Account
                        </button>
                        <button 
                          onClick={() => setRefreshKey(prev => prev + 1)}
                          className="inline-flex items-center justify-center bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-300"
                        >
                          Refresh Status
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {subscriptionStatus === 'suspended' && subscriptionDetails && (
                  <div className="mb-8">
                    <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 mb-4">Suspended Subscription</h2>
                      <p className="text-gray-700 mb-4">
                        Your subscription has been suspended. This may be due to a payment issue. Please check your PayPal account.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <p className="text-gray-600 font-medium">Status</p>
                          <p className="text-yellow-600 font-bold">{subscriptionDetails.status}</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <p className="text-gray-600 font-medium">Subscription ID</p>
                          <p className="text-gray-900 text-sm break-all">{subscriptionDetails.subscriptionId}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                        <button 
                          onClick={() => router.push('/my-account')}
                          className="inline-flex items-center justify-center bg-primary text-white font-medium py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors duration-300"
                        >
                          Go to My Account
                        </button>
                        <button 
                          onClick={() => setRefreshKey(prev => prev + 1)}
                          className="inline-flex items-center justify-center bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors duration-300"
                        >
                          Refresh Status
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {subscriptionStatus === 'inactive' && (
                  <div className="text-center mb-8">
                    <p className="text-gray-700 mb-4">
                      You don&apos;t have an active subscription. Return to your account to subscribe.
                    </p>
                    <div className="mt-6">
                      <Link href="/my-account" className="inline-flex items-center justify-center bg-primary text-white font-medium py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors duration-300">
                        Go to My Account
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 shadow-lg max-w-md mx-auto text-center transition-all duration-300 animate-scale-in">
                <p className="text-gray-700 mb-6">Please sign in to access subscription features.</p>
                <Link href="/my-account" className="inline-flex items-center justify-center bg-primary text-white font-medium py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors duration-300">
                  Go to Sign In
                </Link>
              </div>
            )}
          </div>
          
          <div className="mt-16 pb-8"></div>
        </div>
      </div>
    </>
  );
};

export default Subscription; 