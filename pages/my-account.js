import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../src/context/AuthContext';
import Navigation from '../src/components/Navigation';

const MyAccount = () => {
  const { user, loading, redirectAfterLogin, setRedirectAfterLogin, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [authError, setAuthError] = useState('');

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

  // Redirect to social-posting page only if user just logged in
  useEffect(() => {
    if (!loading && user && redirectAfterLogin) {
      const redirectTimeout = setTimeout(() => {
        router.push('/social-posting');
        setRedirectAfterLogin?.(false); // Reset the flag after redirect
      }, 2000); // Give the user a moment to see they're logged in
      
      return () => clearTimeout(redirectTimeout);
    }
  }, [user, loading, router, redirectAfterLogin, setRedirectAfterLogin]);

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
        <title>My Account | Social Lane</title>
        <meta name="description" content="Manage your Social Lane account" />
      </Head>

      <div className="min-h-screen bg-background">
        <Navigation />
        
        <div className="md:ml-64 pt-6 px-4 sm:px-6 transition-all duration-300">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-8 animate-slide-down">My Account</h1>
            
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
                        user?.role === 'Pro' 
                          ? 'bg-primary text-white shadow-sm shadow-primary/30' 
                          : 'bg-gray-200 text-gray-700'
                      }`}
                      style={{animationDelay: '300ms'}}
                    >
                      {user?.role || 'Free'} Plan
                    </span>
                    {redirectAfterLogin && (
                      <p className="mt-3 text-green-600 font-medium animate-pulse">
                        You are logged in! Redirecting to Social Posting...
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                  <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 animate-scale-in" style={{animationDelay: '200ms'}}>
                    <h3 className="text-xl font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-200">
                      Account Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                        <span className="text-gray-600 font-medium">User ID:</span>
                        <span className="text-gray-800 text-sm break-all">{user?.uid}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                        <span className="text-gray-600 font-medium">Authentication:</span>
                        <span className="text-gray-800">Google</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                        <span className="text-gray-600 font-medium">Subscription:</span>
                        <span className="text-gray-800">{user?.role || 'Free'}</span>
                      </div>
                      {user?.subscriptionStartDate && (
                        <div className="flex justify-between items-center pb-2 border-b border-dashed border-gray-200 hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                          <span className="text-gray-600 font-medium">Subscription Start:</span>
                          <span className="text-gray-800">{formatDate(user?.subscriptionStartDate)}</span>
                        </div>
                      )}
                      {user?.subscriptionEndDate && (
                        <div className="flex justify-between items-center hover:bg-gray-50 px-2 py-1 rounded transition-colors duration-200">
                          <span className="text-gray-600 font-medium">Subscription End:</span>
                          <span className="text-gray-800">{formatDate(user?.subscriptionEndDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 animate-scale-in" style={{animationDelay: '300ms'}}>
                    <h3 className="text-xl font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-200">
                      Quick Links
                    </h3>
                    <div className="flex flex-col gap-3">
                      <Link href="/social-posting" className="group">
                        <div className="bg-gray-100 hover:bg-primary/10 text-primary font-medium px-4 py-3 rounded-lg transition-all duration-300 flex items-center border border-transparent hover:border-primary/20 shadow-sm hover:shadow">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Create New Post
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-auto transition-transform duration-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                      <Link href="/scheduled-posts" className="group">
                        <div className="bg-gray-100 hover:bg-primary/10 text-primary font-medium px-4 py-3 rounded-lg transition-all duration-300 flex items-center border border-transparent hover:border-primary/20 shadow-sm hover:shadow">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          View Scheduled Posts
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-auto transition-transform duration-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {user?.role === 'Free' && (
                    <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 animate-scale-in" style={{animationDelay: '400ms'}}>
                      <h3 className="text-xl font-semibold text-gray-800 pb-3 mb-4 border-b border-gray-200">
                        Upgrade to Pro
                      </h3>
                      <p className="text-gray-700 mb-4">
                        Unlock premium features with our Pro plan:
                      </p>
                      <ul className="mb-6 space-y-3">
                        <li className="flex items-center text-gray-700 bg-gray-50 p-2 rounded-lg">
                          <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <span>Schedule unlimited posts</span>
                        </li>
                        <li className="flex items-center text-gray-700 bg-gray-50 p-2 rounded-lg">
                          <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <span>Analytics and insights</span>
                        </li>
                        <li className="flex items-center text-gray-700 bg-gray-50 p-2 rounded-lg">
                          <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <span>Priority support</span>
                        </li>
                      </ul>
                      <button 
                        disabled
                        className="w-full bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg cursor-not-allowed transition-colors duration-300 relative overflow-hidden group"
                      >
                        <span className="relative z-10">Coming Soon</span>
                        <span className="absolute inset-0 bg-gradient-to-r from-primary to-primary-dark opacity-0 group-hover:opacity-30 transition-opacity duration-300"></span>
                      </button>
                    </div>
                  )}
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