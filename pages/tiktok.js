import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// Force use of the environment variable for API URL with no fallback
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
console.log('Using API URL:', API_BASE_URL); // Debug log

export default function TikTok() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const router = useRouter();

  // Check for existing token in localStorage on component mount
  useEffect(() => {
    // Make sure we're using the correct API URL from environment
    setApiUrl(process.env.NEXT_PUBLIC_API_URL);
    console.log('API URL set in component:', process.env.NEXT_PUBLIC_API_URL);
    
    const savedToken = localStorage.getItem('tiktokAccessToken');
    const savedOpenId = localStorage.getItem('tiktokOpenId');
    if (savedToken) {
      setAccessToken(savedToken);
      setOpenId(savedOpenId);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    // Check for token in URL (new flow)
    const { access_token, open_id, error: urlError } = router?.query || {};
    
    if (urlError) {
      setError(decodeURIComponent(urlError));
      // Remove the error from URL
      router.replace('/tiktok', undefined, { shallow: true });
      return;
    }
    
    if (access_token) {
      console.log('Received access token from URL');
      setAccessToken(access_token);
      setOpenId(open_id || '');
      setIsAuthenticated(true);
      
      // Save token to localStorage for persistence
      localStorage.setItem('tiktokAccessToken', access_token);
      if (open_id) localStorage.setItem('tiktokOpenId', open_id);
      
      // Remove the token from URL for security
      router.replace('/tiktok', undefined, { shallow: true });
    }
  }, [router?.query]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Make sure we're using the environment variable
      const url = `${apiUrl}/tiktok/auth`;
      console.log('Connecting to TikTok via:', url); // Debug log
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
      });
      
      const data = await response?.json();
      console.log('Auth response:', data); // Debug log
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      setError('Failed to initiate TikTok authentication: ' + (error?.message || 'Unknown error'));
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostVideo = async (e) => {
    e.preventDefault();
    if (!videoUrl) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // Use the token from state or localStorage as a fallback
      const token = accessToken || localStorage.getItem('tiktokAccessToken');
      
      if (!token) {
        throw new Error('No access token available. Please reconnect your TikTok account.');
      }
      
      // Make sure we're using the environment variable
      const url = `${apiUrl}/tiktok/post-video`;
      console.log('Posting video to:', url); // Debug log
      console.log('With token (first 10 chars):', token.substring(0, 10) + '...'); // Debug log - only show part of token for security
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify({
          videoUrl,
          accessToken: token,
        }),
      });

      const data = await response?.json();
      console.log('Post response:', data); // Debug log
      
      if (response?.ok) {
        alert('Video posted successfully!');
        setVideoUrl('');
      } else {
        throw new Error(data?.error || 'Failed to post video');
      }
    } catch (error) {
      setError(error?.message || 'Unknown error occurred');
      console.error('Post error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setAccessToken(null);
    setOpenId(null);
    setIsAuthenticated(false);
    localStorage.removeItem('tiktokAccessToken');
    localStorage.removeItem('tiktokOpenId');
  };

  if (isLoading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">TikTok Integration</h1>
      <p className="mb-4 text-blue-600">API URL: {apiUrl || 'Not set'}</p>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {!isAuthenticated ? (
        <div>
          <button
            onClick={handleConnect}
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800"
          >
            Connect TikTok Account
          </button>
          <p className="mt-4 text-sm text-gray-600">
            Click the button above to connect your TikTok account. You will be redirected to TikTok for authentication.
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-green-600">✓ Connected to TikTok</p>
          {openId && <p className="mb-4 text-sm text-gray-600">TikTok User ID: {openId}</p>}
          <form onSubmit={handlePostVideo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Video URL
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Enter video URL"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black p-2 border"
              />
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:bg-gray-400"
              >
                Post to TikTok
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
              >
                Disconnect
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
} 