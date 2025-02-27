import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.scss';

// Use environment variable for API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [message, setMessage] = useState('');
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [accessToken, setAccessToken] = useState(null);

  // Set API URL on component mount and check for existing token
  useEffect(() => {
    setApiUrl(process.env.NEXT_PUBLIC_API_URL);
    console.log('API URL in index.js:', process.env.NEXT_PUBLIC_API_URL);
    
    // Check if we have a token in localStorage
    const savedToken = localStorage.getItem('tiktokAccessToken');
    if (savedToken) {
      setAccessToken(savedToken);
      setIsConnected(true);
      setMessage('Connected to your TikTok account.');
    }
  }, []);

  // Connect to TikTok
  const handleConnect = () => {
    // Redirect to the TikTok page for proper authentication
    window.location.href = '/tiktok';
  };

  // Submit video URL to the backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Posting video...');

    // Get the token from state or localStorage
    const token = accessToken || localStorage.getItem('tiktokAccessToken');
    
    if (!token) {
      setMessage('Error: No access token available. Please connect your TikTok account first.');
      return;
    }

    try {
      console.log('Posting to:', `${apiUrl}/tiktok/post-video`);
      console.log('With token (first 10 chars):', token.substring(0, 10) + '...');
      
      const res = await fetch(`${apiUrl}/tiktok/post-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          videoUrl,
          accessToken: token
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setMessage('Video posted successfully!');
        setVideoUrl('');
      } else {
        setMessage(`Error: ${data.error || 'Failed to post video'}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message || 'Unknown error occurred'}`);
      console.error('Post error:', error);
    }
  };

  // Disconnect from TikTok
  const handleDisconnect = () => {
    localStorage.removeItem('tiktokAccessToken');
    setAccessToken(null);
    setIsConnected(false);
    setMessage('Disconnected from TikTok.');
  };

  return (
    <div className={styles.container}>
      <h1>Social Lane - TikTok Posting</h1>
      <p>API URL: {apiUrl || 'Not set'}</p>
      
      {message && <p className={styles.message}>{message}</p>}
      
      {!isConnected ? (
        <div>
          <button onClick={handleConnect} className={styles.connectBtn}>
            Connect to TikTok
          </button>
          <p className="mt-4 text-sm text-gray-600">
            You need to connect your TikTok account before posting videos.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-green-600 mb-4">✓ Connected to TikTok</p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label htmlFor="videoUrl">Video URL:</label>
            <input
              type="text"
              id="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Enter video URL"
              required
            />
            <div className="flex space-x-4">
              <button type="submit" className={styles.submitBtn}>
                Post Video
              </button>
              <button 
                type="button" 
                onClick={handleDisconnect} 
                className={styles.disconnectBtn || "bg-red-600 text-white px-4 py-2 rounded"}
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