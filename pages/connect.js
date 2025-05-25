import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ProtectedRoute from '../src/components/ProtectedRoute';
import { useLoader } from '../src/context/LoaderContext';
import { getUserLimits } from '../src/services/userService';

// Social media icons
const TikTokIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-.88-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
  </svg>
);

const TwitterIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
  </svg>
);

const PlusIcon = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const CheckIcon = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const API_BASE_URL = 
  typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_API_URL 
    : 'https://sociallane-backend.mindio.chat';

export default function ConnectPage() {
  return (
    <ProtectedRoute>
      <Connect />
    </ProtectedRoute>
  );
}

function Connect() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();
  
  // State
  const [tiktokAccounts, setTiktokAccounts] = useState([]);
  const [twitterAccounts, setTwitterAccounts] = useState([]);
  const [userLimits, setUserLimits] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(null); // 'tiktok' or 'twitter'

  // Get TikTok accounts from localStorage
  const getTikTokAccounts = useCallback(() => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (!socialMediaDataStr) return [];
      
      const socialMediaData = JSON.parse(socialMediaDataStr);
      if (!socialMediaData?.tiktok || !Array.isArray(socialMediaData.tiktok)) return [];
      
      return socialMediaData.tiktok.filter(account => account && account.accountId);
    } catch (error) {
      console.error('Error getting TikTok accounts:', error);
      return [];
    }
  }, []);

  // Get Twitter accounts from localStorage
  const getTwitterAccounts = useCallback(() => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (!socialMediaDataStr) return [];
      
      const socialMediaData = JSON.parse(socialMediaDataStr);
      if (!socialMediaData?.twitter || !Array.isArray(socialMediaData.twitter)) return [];
      
      return socialMediaData.twitter.filter(account => account && account.userId);
    } catch (error) {
      console.error('Error getting Twitter accounts:', error);
      return [];
    }
  }, []);

  // Fetch user accounts from backend
  const fetchUserAccounts = useCallback(async () => {
    const uid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
    if (!uid) {
      console.error('No user ID found');
      setLoading(false);
      return;
    }

    try {
      // Use the loader functions directly without dependencies
      if (showLoader) showLoader('Loading your connected accounts...');
      
      const response = await fetch(`${API_BASE_URL}/users/${uid}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.status}`);
      }

      const userData = await response.json();
      console.log('Fetched user data:', userData);

      if (userData?.success && userData?.data?.providerData) {
        let socialMediaData = {};
        
        try {
          const existingData = localStorage.getItem('socialMediaData');
          if (existingData) socialMediaData = JSON.parse(existingData);
        } catch (e) {
          console.error('Error parsing existing social media data:', e);
        }

        // Process TikTok accounts
        const tiktokData = userData.data.providerData.tiktok;
        if (tiktokData && Array.isArray(tiktokData)) {
          const formattedTiktok = tiktokData
            .filter(account => account?.openId || account?.accountId)
            .map(account => ({
              accountId: account.accountId || account.openId,
              username: account.username || account.userInfo?.username || 'TikTok User',
              displayName: account.displayName || account.userInfo?.display_name || '',
              avatarUrl: account.avatarUrl || account.userInfo?.avatar_url || '',
              avatarUrl100: account.avatarUrl100 || ''
            }));
          
          if (formattedTiktok.length > 0) {
            socialMediaData.tiktok = formattedTiktok;
            setTiktokAccounts(formattedTiktok);
          }
        }

        // Process Twitter accounts
        const twitterData = userData.data.providerData.twitter;
        if (twitterData) {
          const twitterArray = Array.isArray(twitterData) ? twitterData : [twitterData];
          const formattedTwitter = twitterArray
            .filter(account => account?.userId)
            .map(account => ({
              userId: account.userId,
              username: account.username || account.screen_name || '',
              name: account.name || account.displayName || account.username || 'Twitter User',
              profileImageUrl: account.profileImageUrl || account.profile_image_url || ''
            }));
          
          if (formattedTwitter.length > 0) {
            socialMediaData.twitter = formattedTwitter;
            setTwitterAccounts(formattedTwitter);
          }
        }

        // Save to localStorage
        localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
        localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
      }
    } catch (error) {
      console.error('Error fetching user accounts:', error);
      // Load from localStorage as fallback - inline the logic to avoid dependency issues
      try {
        const socialMediaDataStr = localStorage?.getItem('socialMediaData');
        if (socialMediaDataStr) {
          const socialMediaData = JSON.parse(socialMediaDataStr);
          
          // Set TikTok accounts
          if (socialMediaData?.tiktok && Array.isArray(socialMediaData.tiktok)) {
            const tiktokAccounts = socialMediaData.tiktok.filter(account => account && account.accountId);
            setTiktokAccounts(tiktokAccounts);
          }
          
          // Set Twitter accounts
          if (socialMediaData?.twitter && Array.isArray(socialMediaData.twitter)) {
            const twitterAccounts = socialMediaData.twitter.filter(account => account && account.userId);
            setTwitterAccounts(twitterAccounts);
          }
        }
      } catch (fallbackError) {
        console.error('Error loading accounts from localStorage:', fallbackError);
      }
    } finally {
      // Use the loader functions directly without dependencies
      if (hideLoader) hideLoader();
      setLoading(false);
    }
  }, []); // Remove showLoader and hideLoader dependencies

  // Fetch user limits
  const fetchLimits = useCallback(async () => {
    const uid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
    if (!uid) {
      setLimitsLoading(false);
      return;
    }

    try {
      const limitsResponse = await getUserLimits(uid);
      if (limitsResponse?.success) {
        setUserLimits(limitsResponse.data);
      } else {
        console.error('Failed to fetch user limits:', limitsResponse?.error);
      }
    } catch (error) {
      console.error('Error fetching user limits:', error);
    } finally {
      setLimitsLoading(false);
    }
  }, []);

  // Initialize component
  useEffect(() => {
    const uid = localStorage?.getItem('firebaseUid') || localStorage?.getItem('userId');
    if (uid) {
      setUserId(uid);
      fetchUserAccounts();
      fetchLimits();
    } else {
      setLoading(false);
      setLimitsLoading(false);
    }

    // Load accounts from localStorage initially - inline the logic to avoid dependency issues
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (socialMediaDataStr) {
        const socialMediaData = JSON.parse(socialMediaDataStr);
        
        // Set TikTok accounts
        if (socialMediaData?.tiktok && Array.isArray(socialMediaData.tiktok)) {
          const tiktokAccounts = socialMediaData.tiktok.filter(account => account && account.accountId);
          setTiktokAccounts(tiktokAccounts);
        }
        
        // Set Twitter accounts
        if (socialMediaData?.twitter && Array.isArray(socialMediaData.twitter)) {
          const twitterAccounts = socialMediaData.twitter.filter(account => account && account.userId);
          setTwitterAccounts(twitterAccounts);
        }
      }
    } catch (error) {
      console.error('Error loading initial accounts from localStorage:', error);
    }

    // Listen for storage updates
    const handleStorageUpdate = () => {
      const updated = localStorage?.getItem('socialMediaDataUpdated');
      if (updated) {
        try {
          const socialMediaDataStr = localStorage?.getItem('socialMediaData');
          if (socialMediaDataStr) {
            const socialMediaData = JSON.parse(socialMediaDataStr);
            
            // Update TikTok accounts
            if (socialMediaData?.tiktok && Array.isArray(socialMediaData.tiktok)) {
              const tiktokAccounts = socialMediaData.tiktok.filter(account => account && account.accountId);
              setTiktokAccounts(tiktokAccounts);
            }
            
            // Update Twitter accounts
            if (socialMediaData?.twitter && Array.isArray(socialMediaData.twitter)) {
              const twitterAccounts = socialMediaData.twitter.filter(account => account && account.userId);
              setTwitterAccounts(twitterAccounts);
            }
          }
        } catch (error) {
          console.error('Error updating accounts from localStorage:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  // Check if account limit is reached
  const isAccountLimitReached = useMemo(() => {
    if (!userLimits) return false;
    
    const limit = userLimits.socialAccounts;
    const currentCount = userLimits.currentSocialAccounts;
    
    if (limit === -1) return false; // Unlimited
    return currentCount >= limit;
  }, [userLimits]);

  const accountLimitMessage = useMemo(() => {
    if (!isAccountLimitReached || !userLimits) return null;
    const limit = userLimits.socialAccounts;
    return `You've reached your plan limit of ${limit} connected social account${limit > 1 ? 's' : ''}. Please upgrade or disconnect an existing account.`;
  }, [isAccountLimitReached, userLimits]);

  // Handle TikTok connection
  const handleTikTokConnect = async () => {
    if (isAccountLimitReached) {
      window.showToast?.error?.(accountLimitMessage || 'Social account limit reached.');
      return;
    }

    if (!userId) {
      window.showToast?.error?.('User ID missing, cannot connect. Please login again.');
      return;
    }

    setIsConnecting('tiktok');
    try {
      window.location.href = `${API_BASE_URL}/tiktok/auth?userId=${userId}`;
    } catch (error) {
      console.error('Error connecting TikTok:', error);
      window.showToast?.error?.('Failed to initiate TikTok connection.');
      setIsConnecting(null);
    }
  };

  // Handle Twitter connection
  const handleTwitterConnect = async () => {
    if (isAccountLimitReached) {
      window.showToast?.error?.(accountLimitMessage || 'Social account limit reached.');
      return;
    }

    if (!userId) {
      window.showToast?.error?.('User ID missing, cannot connect. Please login again.');
      return;
    }

    setIsConnecting('twitter');
    try {
      // Use the loader functions directly without dependencies
      if (showLoader) showLoader('Redirecting to Twitter...');
      
      // Generate a unique state parameter for CSRF protection
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('twitterAuthState', state);
      localStorage.setItem('twitterAuthTimestamp', Date.now().toString());

      // 1. Fetch the auth URL from the backend as JSON
      const response = await fetch(`${API_BASE_URL}/twitter/auth?state=${state}&userId=${userId}&redirect_url=/connect`);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { error: `HTTP error! status: ${response.status}` };
        }
        throw new Error(errorData?.error || `Failed to fetch auth URL: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.authUrl) {
        throw new Error('Auth URL not found in response from backend.');
      }

      console.log('Received Twitter auth URL from backend:', data.authUrl);

      // 2. Redirect the user to the actual Twitter authorization URL
      window.location.href = data.authUrl;

    } catch (error) {
      console.error('Error connecting Twitter:', error);
      window.showToast?.error?.(`Failed to initiate Twitter connection: ${error.message}`);
      setIsConnecting(null);
      // Use the loader functions directly without dependencies
      if (hideLoader) hideLoader();
    }
  };

  // Handle account disconnection
  const handleDisconnect = async (platform, account) => {
    if (!account) return;

    try {
      // Use the loader functions directly without dependencies
      if (showLoader) showLoader(`Disconnecting ${platform} account...`);
      
      const firebaseUid = localStorage?.getItem('firebaseUid');
      if (!firebaseUid) {
        throw new Error('No user ID found');
      }

      let endpoint;
      if (platform === 'tiktok') {
        endpoint = `/api/users/${firebaseUid}/social/tiktok/${account.accountId}`;
      } else if (platform === 'twitter') {
        endpoint = `/api/users/${firebaseUid}/social/twitter/${account.userId}`;
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect ${platform} account: ${response.status}`);
      }

      // Update local state
      if (platform === 'tiktok') {
        const updatedAccounts = tiktokAccounts.filter(a => a.accountId !== account.accountId);
        setTiktokAccounts(updatedAccounts);
        
        // Update localStorage
        const socialMediaData = JSON.parse(localStorage.getItem('socialMediaData') || '{}');
        socialMediaData.tiktok = updatedAccounts;
        localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
      } else if (platform === 'twitter') {
        const updatedAccounts = twitterAccounts.filter(a => a.userId !== account.userId);
        setTwitterAccounts(updatedAccounts);
        
        // Update localStorage
        const socialMediaData = JSON.parse(localStorage.getItem('socialMediaData') || '{}');
        socialMediaData.twitter = updatedAccounts;
        localStorage.setItem('socialMediaData', JSON.stringify(socialMediaData));
      }

      localStorage.setItem('socialMediaDataUpdated', Date.now().toString());
      window.dispatchEvent(new Event('storage'));
      
      window.showToast?.success?.(`Successfully disconnected ${platform} account`);
    } catch (error) {
      console.error(`Error disconnecting ${platform} account:`, error);
      window.showToast?.error?.(`Failed to disconnect ${platform} account: ${error.message}`);
    } finally {
      // Use the loader functions directly without dependencies
      if (hideLoader) hideLoader();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>Connect Accounts - Social Lane</title>
        </Head>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  const totalConnectedAccounts = tiktokAccounts.length + twitterAccounts.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Connect Accounts - Social Lane</title>
        <meta name="description" content="Manage your connected social media accounts" />
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Connected Accounts</h1>
          <p className="mt-2 text-lg text-gray-600">
            Manage your social media accounts and connect new platforms
          </p>
          
          {/* Account Limits Info */}
          {!limitsLoading && userLimits && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Connected Accounts: {totalConnectedAccounts}
                    {userLimits.socialAccounts !== -1 && ` / ${userLimits.socialAccounts}`}
                  </p>
                  {userLimits.socialAccounts === -1 ? (
                    <p className="text-xs text-blue-600">Unlimited accounts</p>
                  ) : (
                    <p className="text-xs text-blue-600">
                      {userLimits.socialAccounts - totalConnectedAccounts} remaining
                    </p>
                  )}
                </div>
                {isAccountLimitReached && (
                  <Link href="/subscription" className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors">
                    Upgrade Plan
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Social Media Platforms Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* TikTok Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-black rounded-lg">
                    <TikTokIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">TikTok</h2>
                    <p className="text-sm text-gray-500">
                      {tiktokAccounts.length} account{tiktokAccounts.length !== 1 ? 's' : ''} connected
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTikTokConnect}
                  disabled={isConnecting === 'tiktok' || isAccountLimitReached}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isAccountLimitReached
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-gray-800'
                  }`}
                >
                  {isConnecting === 'tiktok' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-4 h-4" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-6">
              {tiktokAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <TikTokIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No TikTok accounts connected</p>
                  <p className="text-sm text-gray-400">
                    Connect your TikTok account to start posting videos
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tiktokAccounts.map((account) => (
                    <div
                      key={account.accountId}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {account.avatarUrl100 || account.avatarUrl ? (
                            <img
                              src={account.avatarUrl100 || account.avatarUrl}
                              alt={account.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                              <TikTokIcon className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            @{account.username}
                          </p>
                          {account.displayName && (
                            <p className="text-sm text-gray-500">
                              {account.displayName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-green-600">
                          <CheckIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Connected</span>
                        </div>
                        <button
                          onClick={() => handleDisconnect('tiktok', account)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Twitter Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <TwitterIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Twitter</h2>
                    <p className="text-sm text-gray-500">
                      {twitterAccounts.length} account{twitterAccounts.length !== 1 ? 's' : ''} connected
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTwitterConnect}
                  disabled={isConnecting === 'twitter' || isAccountLimitReached}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isAccountLimitReached
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {isConnecting === 'twitter' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-4 h-4" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-6">
              {twitterAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <TwitterIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No Twitter accounts connected</p>
                  <p className="text-sm text-gray-400">
                    Connect your Twitter account to start posting tweets
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {twitterAccounts.map((account) => (
                    <div
                      key={account.userId}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {account.profileImageUrl ? (
                            <img
                              src={account.profileImageUrl}
                              alt={account.username}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                              <TwitterIcon className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            @{account.username}
                          </p>
                          {account.name && account.name !== account.username && (
                            <p className="text-sm text-gray-500">
                              {account.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-green-600">
                          <CheckIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Connected</span>
                        </div>
                        <button
                          onClick={() => handleDisconnect('twitter', account)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/media-posting"
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h3a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h3zM7 8v8a1 1 0 001 1h8a1 1 0 001-1V8H7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Post Content</p>
                <p className="text-sm text-gray-500">Create and publish posts</p>
              </div>
            </Link>

            <Link
              href="/scheduled-posts"
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Schedule Posts</p>
                <p className="text-sm text-gray-500">Plan your content</p>
              </div>
            </Link>

            <Link
              href="/posts-history"
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">View History</p>
                <p className="text-sm text-gray-500">Check past posts</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 