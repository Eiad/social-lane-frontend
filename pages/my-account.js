import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/MyAccount.module.scss';
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
        setRedirectAfterLogin(false); // Reset the flag after redirect
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

      <div className={styles.container}>
        <Navigation />
        
        <div className={styles.accountContainer}>
          <h1>My Account</h1>
          
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
          ) : user ? (
            <div className={styles.userInfo}>
              <div className={styles.profile}>
                {user?.photoURL && (
                  <img 
                    src={user?.photoURL} 
                    alt={user?.displayName || 'Profile'} 
                    className={styles.profileImage}
                  />
                )}
                
                <div className={styles.userDetails}>
                  <h2>{user?.displayName || 'User'}</h2>
                  <p>{user?.email || 'No email provided'}</p>
                  <div className={styles.subscriptionBadge} data-role={user?.role || 'Free'}>
                    {user?.role || 'Free'} Plan
                  </div>
                  {redirectAfterLogin && (
                    <p className={styles.successMessage}>
                      You are logged in! Redirecting to Social Posting...
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.accountInfoCards}>
                <div className={styles.accountInfoCard}>
                  <h3>Account Information</h3>
                  <div className={styles.accountInfoItem}>
                    <span>User ID:</span>
                    <span>{user?.uid}</span>
                  </div>
                  <div className={styles.accountInfoItem}>
                    <span>Authentication Provider:</span>
                    <span>Google</span>
                  </div>
                  <div className={styles.accountInfoItem}>
                    <span>Subscription Type:</span>
                    <span>{user?.role || 'Free'}</span>
                  </div>
                  {user?.subscriptionStartDate && (
                    <div className={styles.accountInfoItem}>
                      <span>Subscription Start:</span>
                      <span>{formatDate(user.subscriptionStartDate)}</span>
                    </div>
                  )}
                  {user?.subscriptionEndDate && (
                    <div className={styles.accountInfoItem}>
                      <span>Subscription End:</span>
                      <span>{formatDate(user.subscriptionEndDate)}</span>
                    </div>
                  )}
                </div>
                
                <div className={styles.accountInfoCard}>
                  <h3>Quick Links</h3>
                  <div className={styles.accountLinks}>
                    <Link href="/social-posting" className={styles.accountLink}>
                      Create New Post
                    </Link>
                    <Link href="/scheduled-posts" className={styles.accountLink}>
                      View Scheduled Posts
                    </Link>
                  </div>
                </div>

                {user?.role === 'Free' && (
                  <div className={styles.accountInfoCard}>
                    <h3>Upgrade to Pro</h3>
                    <p className={styles.upgradeText}>
                      Unlock premium features with our Pro plan:
                    </p>
                    <ul className={styles.featuresList}>
                      <li>Schedule unlimited posts</li>
                      <li>Analytics and insights</li>
                      <li>Priority support</li>
                    </ul>
                    <button className={styles.upgradeButton} disabled>
                      Coming Soon
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.authContainer}>
              <p>Please sign in to access your account and Social Lane features.</p>
              
              <button 
                onClick={handleGoogleSignIn}
                disabled={isProcessing}
                className={styles.googleButton}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner small"></span>
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="24" height="24">
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
              </button>
              
              {authError && <p className={styles.errorMessage}>{authError}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MyAccount; 