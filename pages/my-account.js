import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../src/context/AuthContext';
import { createSubscription } from '../src/services/subscriptionService';
import SubscriptionStatus from '../src/components/SubscriptionStatus';

const MyAccount = () => {
  const { user, loading, redirectAfterLogin, setRedirectAfterLogin, signInWithGoogle } = useAuth();
  const router = useRouter();
  const { subscription, message } = router.query;
  const [isProcessing, setIsProcessing] = useState(false);
  const [authError, setAuthError] = useState('');
  const [subscriptionError, setSubscriptionError] = useState('');
  const [subscriptionSuccess, setSubscriptionSuccess] = useState(false);

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (user && !loading) {
      if (redirectAfterLogin) {
        setRedirectAfterLogin(false);
        router.push('/social-posting');
      }
    }
  }, [user, loading, redirectAfterLogin, router, setRedirectAfterLogin]);

  // Handle subscription success message from query params
  useEffect(() => {
    if (subscription === 'success') {
      setSubscriptionSuccess(true);
      // Clear the success message after 5 seconds
      const timer = setTimeout(() => {
        setSubscriptionSuccess(false);
        // Remove the query parameters without refreshing the page
        const url = new URL(window.location.href);
        url.searchParams.delete('subscription');
        url.searchParams.delete('uid');
        window.history.replaceState({}, '', url);
      }, 5000);
      return () => clearTimeout(timer);
    } else if (subscription === 'error') {
      setSubscriptionError(message || 'An error occurred with your subscription');
    }
  }, [subscription, message]);

  const handleGoogleSignIn = async () => {
    setIsProcessing(true);
    setAuthError('');
    
    try {
      const result = await signInWithGoogle();
      if (!result?.success) {
        setAuthError(result?.error || 'Failed to sign in. Please try again.');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
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

  // Handle subscription button click
  const handleSubscribe = async () => {
    if (!user?.uid) return;
    
    setIsProcessing(true);
    setSubscriptionError('');
    
    try {
      const result = await createSubscription(user?.uid);
      if (result?.success && result?.data?.approvalUrl) {
        // Redirect to PayPal approval URL
        window.location.href = result?.data?.approvalUrl;
      } else {
        setSubscriptionError('Failed to create subscription. Please try again.');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      setSubscriptionError(error?.response?.data?.error || 'An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cancel subscription
  const handleCancelSubscription = () => {
    router.push('/subscription?action=cancel');
  };

  // Add a subscription plans constant
  const subscriptionPlans = [
    {
      name: 'Launch',
      price: '$9',
      description: 'Best for beginner creators',
      features: [
        '5 connected social accounts',
        'Unlimited posts',
        'Schedule posts',
        'Carousel posts',
      ],
      highlight: false
    },
    {
      name: 'Rise',
      price: '$18',
      description: 'Best for growing creators',
      features: [
        '15 connected social accounts',
        'Unlimited posts',
        'Schedule posts',
        'Carousel posts',
        'Content studio access',
        'Limited growth consulting',
      ],
      highlight: true
    },
    {
      name: 'Scale',
      price: '$27',
      description: 'Best for scaling brands',
      features: [
        'Unlimited connected accounts',
        'Unlimited posts',
        'Schedule posts',
        'Carousel posts',
        'Content studio access',
        'Priority growth consulting',
      ],
      highlight: false
    }
  ];

  // Add a function to render the upgrade box for Starter plan users
  const renderUpgradeBox = () => {
    // Find the recommended plan (usually Rise with highlight=true)
    const recommendedPlan = subscriptionPlans.find(plan => plan.highlight) || subscriptionPlans[1];
    
    return (
      <div className="mt-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 shadow-md animate-scale-in">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Upgrade to {recommendedPlan.name}
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Recommended
              </span>
            </h3>
            <p className="text-gray-600 mb-4">
              Take your social media presence to the next level with our most popular plan.
            </p>
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-900">{recommendedPlan.price}</span>
              <span className="text-gray-500 ml-1">/month</span>
            </div>
            <ul className="space-y-2 mb-6">
              {recommendedPlan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Link href="/subscription" className="inline-block">
              <button className="bg-primary hover:bg-primary-dark text-white font-medium py-2 px-6 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md">
                View All Plans
              </button>
            </Link>
          </div>
          <div className="w-full md:w-1/3 bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3">Why upgrade?</h4>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 font-bold text-sm mr-2">1</span>
                <span className="text-gray-700">Connect to more social platforms</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 font-bold text-sm mr-2">2</span>
                <span className="text-gray-700">Access exclusive content tools</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 font-bold text-sm mr-2">3</span>
                <span className="text-gray-700">Get expert growth consulting</span>
              </li>
              <li className="flex items-start">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 font-bold text-sm mr-2">4</span>
                <span className="text-gray-700">7-day money back guarantee</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>My Account | Social Lane</title>
        <meta name="description" content="Manage your Social Lane account" />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="pt-6 px-4 sm:px-6 transition-all duration-300">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-8 animate-slide-down">My Account</h1>
            
            {/* Subscription Success Message */}
            {subscriptionSuccess && (
              <div className="mb-6 bg-green-100 text-green-800 p-4 rounded-lg animate-fade-in flex items-center justify-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>Your subscription has been activated successfully! You now have access to all premium features.</span>
              </div>
            )}
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="spinner"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            ) : user ? (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 sm:p-8 shadow-lg transition-all duration-500 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-center sm:items-start">
                  {user?.photoURL && (
                    <div className="relative group">
                      <img 
                        src={user?.photoURL} 
                        alt={user?.displayName || 'Profile'} 
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-primary ring-4 ring-primary/20 mb-6 sm:mb-0 sm:mr-8 transition-all duration-500 group-hover:scale-105 shadow-md"
                      />
                      <div className="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  )}
                  
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1 animate-slide-up" style={{animationDelay: '100ms'}}>
                      {user?.displayName || 'User'}
                    </h2>
                    <p className="text-gray-700 mb-2 animate-slide-up" style={{animationDelay: '200ms'}}>
                      {user?.email || 'No email provided'}
                    </p>
                    <span 
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 animate-slide-up ${
                        ['Launch', 'Rise', 'Scale'].includes(user?.role)
                          ? 'bg-primary text-white shadow-sm shadow-primary/30' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                      style={{animationDelay: '300ms'}}
                    >
                      {user?.role || 'Starter'} Plan
                    </span>
                    {redirectAfterLogin && (
                      <p className="mt-3 text-green-600 font-medium animate-pulse">
                        You are logged in! Redirecting to Social Posting...
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 mt-8">
                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-md p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 animate-scale-in" style={{animationDelay: '200ms'}}>
                    <h3 className="text-2xl font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-200 flex items-center">
                      Subscription Details
                      <span className={`ml-auto text-sm font-medium py-1 px-3 rounded-full ${
                        user?.role === 'Starter' 
                          ? 'bg-gray-200 text-gray-700' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user?.role || 'Starter'} Plan
                      </span>
                    </h3>
                    
                    {/* If user has a subscription, show details */}
                    <SubscriptionStatus />
                    
                    {/* If user is on Starter plan or not on Scale yearly, show upgrade button */}
                    {(user?.role === 'Starter' || (user?.role !== 'Scale' || user?.subscription?.planId?.includes('month'))) && (
                      <div className="mt-6 flex flex-col sm:flex-row gap-4">
                        <Link href="/subscription" className="w-full">
                          <button 
                            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                            </svg>
                            Upgrade Plan
                          </button>
                        </Link>
                        
                        {/* Only show Cancel Plan if user is not on Starter plan */}
                        {user?.role !== 'Starter' && (
                          <button 
                            onClick={handleCancelSubscription}
                            className="w-full border border-red-500 text-red-500 hover:bg-red-50 font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Cancel Plan
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Upgrade Box (only for Starter plan users) */}
                  {user?.role === 'Starter' && renderUpgradeBox()}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 shadow-lg max-w-md mx-auto text-center transition-all duration-300 animate-scale-in">
                <p className="text-gray-700 mb-6">Please sign in to access your account and Social Lane features.</p>
                
                <button 
                  onClick={handleGoogleSignIn}
                  disabled={isProcessing}
                  className="inline-flex items-center justify-center gap-2 bg-white text-gray-800 border border-gray-300 rounded-lg px-6 py-3 font-medium shadow-sm hover:shadow-md transition-all duration-300 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden group"
                >
                  <span className="absolute inset-0 w-0 bg-primary/5 transition-all duration-500 ease-out group-hover:w-full"></span>
                  <span className="relative">
                    {isProcessing ? (
                      <>
                        <span className="spinner small"></span>
                        Signing in...
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" width="20" height="20" className="flex-shrink-0">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Sign in with Google
                      </>
                    )}
                  </span>
                </button>
                
                {authError && (
                  <p className="mt-4 text-red-600 text-sm animate-fade-in">
                    {authError}
                  </p>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-16 pb-8"></div>
        </div>
      </div>
    </>
  );
};

export default MyAccount; 