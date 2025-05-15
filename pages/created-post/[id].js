import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { TikTokSimpleIcon, TwitterIcon } from '../../src/components/icons/SocialIcons';
import ProtectedRoute from '../../src/components/ProtectedRoute';

const API_URL = 'https://sociallane-backend.mindio.chat';

// Create a cache outside the component to persist between renders
const postCache = {};
// Cache expiration time - 1 hour in milliseconds
const CACHE_EXPIRY = 60 * 60 * 1000;

function PostDetails() {
  const router = useRouter();
  const { id } = router.query;
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch when ID is available, not currently fetching, and hasn't been fetched before
    if (id && !fetchingData && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchPostDetails(id);
    }
  }, [id]); // Remove fetchingData from dependencies to prevent re-fetching

  // Helper function to get cached posts from localStorage
  const getLocalStorageCache = () => {
    try {
      const cachedData = localStorage.getItem('posted-details');
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
    }
    return { data: {}, timestamp: Date.now() };
  };

  // Helper function to save cache to localStorage
  const saveToLocalStorage = (allCache, postId, postData) => {
    try {
      // Update the specific post in the cache
      allCache.data[postId] = {
        post: postData,
        timestamp: Date.now()
      };
      
      // Update the main timestamp
      allCache.timestamp = Date.now();
      
      // Save back to localStorage
      localStorage.setItem('posted-details', JSON.stringify(allCache));
      console.log("Updated post data in localStorage cache");
    } catch (error) {
      console.warn('Error saving to localStorage:', error);
    }
  };

  // Helper to prepare platform results from processing_results
  const preparePlatformResults = (processingResults) => {
    if (!processingResults) return [];
    
    const platformResults = [];
    
    // Process TikTok results
    if (processingResults.tiktok) {
      const tiktokResults = Array.isArray(processingResults.tiktok) 
        ? processingResults.tiktok 
        : [processingResults.tiktok];
        
      tiktokResults.forEach(result => {
        // For TikTok, ensure we at least have a profile link if username is available
        let postLink = result.postUrl || '';
        if (!postLink && result.username) {
          postLink = `https://www.tiktok.com/@${result.username}`;
        }
        
        platformResults.push({
          platformName: 'tiktok',
          accountId: result.accountId || result.username || '',
          accountName: result.username || '',
          success: result.success === true,
          postLink: postLink,
          errorDetails: result.error || ''
        });
      });
    }
    
    // Process Twitter results
    if (processingResults.twitter) {
      const twitterResults = Array.isArray(processingResults.twitter) 
        ? processingResults.twitter 
        : [processingResults.twitter];
        
      twitterResults.forEach(result => {
        let postLink = '';
        if (result.success && (result.tweet_id || (result.data && result.data.id))) {
          postLink = `https://twitter.com/${result.username || 'user'}/status/${result.tweet_id || result.data?.id}`;
        }
        
        platformResults.push({
          platformName: 'twitter',
          accountId: result.accountId || result.userId || '',
          accountName: result.username || '',
          success: result.success === true,
          postLink: postLink,
          errorDetails: result.error || ''
        });
      });
    }
    
    return platformResults;
  };

  const fetchPostDetails = async (postId) => {
    try {
      setLoading(true);
      setError(null);
      setFetchingData(true);
      
      // First check localStorage cache
      try {
        const allCache = getLocalStorageCache();
        
        // Check if the specific post exists in the cache and is still valid
        if (allCache?.data && 
            allCache.data[postId] && 
            allCache.data[postId].timestamp && 
            (Date.now() - allCache.data[postId].timestamp < CACHE_EXPIRY)) {
          
          const cachedEntry = allCache.data[postId];
          // If the cached post is NOT in a transient state (pending/processing), use it.
          if (cachedEntry.post && cachedEntry.post.status !== 'pending' && cachedEntry.post.status !== 'processing') {
            console.log("Using valid (non-transient) localStorage cached post data for:", postId);
            setPost(cachedEntry.post);
            
            // Also update the in-memory cache for faster access in the same session
            postCache[postId] = {
              post: cachedEntry.post,
              timestamp: cachedEntry.timestamp // Use original timestamp from localStorage
            };
            
            setLoading(false);
            setFetchingData(false);
            return; // Important: return here
          } else {
            console.log("localStorage cache for post", postId, "is transient (pending/processing) or invalid, will fetch from API.");
            // Do not return, proceed to fetch from API
          }
        } else {
          console.log("No valid cache for post in localStorage, or cache expired:", postId);
        }
      } catch (cacheError) {
        console.warn("Error reading from localStorage cache:", cacheError);
      }
      
      // Check if we have this post in memory cache
      if (postCache[postId]) {
        const cachedEntry = postCache[postId];
        // If the cached post is NOT in a transient state and cache entry is valid, use it.
        // Check timestamp for in-memory cache as well to align with CACHE_EXPIRY logic
        if (cachedEntry.post && 
            cachedEntry.post.status !== 'pending' && 
            cachedEntry.post.status !== 'processing' &&
            (Date.now() - cachedEntry.timestamp < CACHE_EXPIRY)) {
          console.log("Using valid (non-transient) memory cached post data for:", postId);
          setPost(cachedEntry.post);
          setLoading(false);
          setFetchingData(false);
          return; // Important: return here
        } else {
            console.log("In-memory cache for post", postId, "is transient, expired or invalid, will fetch from API.");
            // Do not return, proceed to fetch from API
        }
      }

      // Fetch post details
      const postResponse = await fetch(`${API_URL}/posts/${postId}`);
      if (!postResponse.ok) {
        const status = postResponse.status;
        
        // Handle specific status codes
        if (status === 429) {
          throw new Error('Too many requests. Please try again in a moment.');
        } else if (status === 404) {
          throw new Error(`Post not found. The post may have been deleted or the ID is incorrect.`);
        } else {
          throw new Error(`Failed to fetch post: ${status} ${postResponse.statusText}`);
        }
      }
      
      const postData = await postResponse.json();
      console.log("Post data received:", postData);
      
      // Enhance post data with platformResults derived from processing_results
      if (postData.processing_results) {
        postData.platformResults = preparePlatformResults(postData.processing_results);
      }
      
      setPost(postData);
      
      // Cache the post data in memory
      postCache[postId] = {
        post: postData,
        timestamp: Date.now()
      };
      
      // Also cache in localStorage for persistence between page reloads
      const allCache = getLocalStorageCache();
      saveToLocalStorage(allCache, postId, postData);
      
    } catch (err) {
      console.error('Error fetching post details:', err);
      setError(err?.message || 'Failed to load post details');
    } finally {
      setLoading(false);
      setFetchingData(false);
    }
  };

  // Format a date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      // Check if date is valid before formatting
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  };

  // Get status badge based on post status
  const StatusBadge = ({ status }) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    let color = "";
    
    // Convert status to lowercase and trim for consistent comparison
    const normalizedStatus = status?.toLowerCase()?.trim() || '';
    
    console.log("Rendering status badge for:", normalizedStatus); // Debug the status value
    
    switch(normalizedStatus) {
      case 'completed':
      case 'success':
        color = "bg-green-100 text-green-800";
        break;
      case 'failed':
      case 'failure':
        color = "bg-red-100 text-red-800";
        break;
      case 'partial':
        color = "bg-yellow-100 text-yellow-800";
        break;
      case 'pending':
        color = "bg-blue-100 text-blue-800";
        break;
      case 'processing':
        color = "bg-purple-100 text-purple-800";
        break;
      default:
        color = "bg-gray-100 text-gray-800";
    }
    
    return <span className={`${baseClasses} ${color}`}>{status}</span>;
  };

  // Platform icon component
  const PlatformIcon = ({ platform }) => {
    switch(platform) {
      case 'tiktok':
        return <TikTokSimpleIcon className="h-5 w-5" />;
      case 'twitter':
        return <TwitterIcon className="h-5 w-5" />;
      default:
        return <span className="text-xs">{platform}</span>;
    }
  };

  // Video Popup Component
  const VideoPopup = ({ videoUrl, onClose }) => {
    const [videoError, setVideoError] = useState(false);
    const [videoLoading, setVideoLoading] = useState(true);

    // Reset error state when popup is opened with a new video
    useEffect(() => {
      if (showVideoPopup) {
        setVideoError(false);
        setVideoLoading(true);
      }
    }, [showVideoPopup]);

    const handleVideoError = () => {
      setVideoError(true);
      setVideoLoading(false);
    };

    const handleVideoLoad = () => {
      setVideoLoading(false);
    };
    
    if (!showVideoPopup) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-medium text-lg">Video Preview</h3>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 flex-1 overflow-auto">
            {!videoUrl ? (
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 flex flex-col items-center justify-center p-4 rounded">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-700 font-medium mb-1">No video available</p>
                <p className="text-gray-500 text-sm text-center">The video URL is missing or invalid.</p>
              </div>
            ) : videoError ? (
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 flex flex-col items-center justify-center p-4 rounded">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-gray-700 font-medium mb-1">Unable to play video</p>
                <p className="text-gray-500 text-sm text-center">The video may be unavailable or in an unsupported format.</p>
              </div>
            ) : (
              <div className="aspect-w-16 aspect-h-9 relative">
                {videoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
                  </div>
                )}
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay
                  onError={handleVideoError}
                  onLoadedData={handleVideoLoad}
                  className="rounded object-contain w-full h-full"
                ></video>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4">
        <div className="text-red-500 text-xl mb-4 text-center max-w-md">
          {error.includes('429') || error.includes('Too many requests') ? (
            <>
              <h2 className="font-bold mb-2">Rate Limit Exceeded</h2>
              <p>We&apos;re receiving too many requests right now. Please wait a moment and try again.</p>
            </>
          ) : error.includes('404') || error.includes('not found') ? (
            <>
              <h2 className="font-bold mb-2">Post Not Found</h2>
              <p>This post may have been deleted or you may have an incorrect link.</p>
            </>
          ) : (
            error
          )}
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Return to Dashboard
        </button>
        <button 
          onClick={() => router.push('/posts-history')}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded mt-2"
        >
          View All Posts
        </button>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4">
        <div className="text-xl mb-4">Post not found</div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Extract processing results from post
  const processingResults = post?.processing_results || {};

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pt-8">
        <Head>
          <title>Post Details - Social Lane</title>
          <meta name="description" content="View details of your social media post" />
        </Head>        
        <main className="container mx-auto">
        <div className="mb-6">
            <Link href="/posts-history" className="text-blue-500 hover:text-blue-700 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to posts history
            </Link>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
            <h1 className="text-xl font-semibold text-gray-900">Post Details</h1>
            </div>

            {/* Two Column Layout */}
            <div className="px-6 py-4">
            {/* Status and Info - Top Row */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
                <div className="flex flex-wrap items-center gap-20">
                <div className="flex items-center">
                    <div className="bg-gray-200 p-2 rounded-full mr-3">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    </div>
                    <div>
                    <span className="block text-sm font-medium text-gray-500">Status</span>
                    <StatusBadge status={post?.status} />
                    </div>
                </div>

                <div className="flex items-center">
                    <div className="bg-gray-200 p-2 rounded-full mr-3">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    </div>
                    <div>
                    <span className="block text-sm font-medium text-gray-500">Created</span>
                    <span className="text-gray-900">{formatDate(post?.createdAt || post?.date)}</span>
                    </div>
                </div>

                {post?.isScheduled && (
                    <div className="flex items-center">
                    <div className="bg-gray-200 p-2 rounded-full mr-3">
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <span className="block text-sm font-medium text-gray-500">Scheduled For</span>
                        <span className="text-gray-900">{formatDate(post?.scheduledDate)}</span>
                    </div>
                    </div>
                )}

                <div className="flex items-center">
                    <div className="bg-gray-200 p-2 rounded-full mr-3">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    </div>
                    <div>
                    <span className="block text-sm font-medium text-gray-500">Platforms</span>
                    <div className="flex space-x-2 mt-1">
                        {post?.platforms?.map(platform => (
                        <div key={platform} className="flex items-center">
                            <PlatformIcon platform={platform} />                            
                        </div>
                        ))}
                    </div>
                    </div>
                </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
                {/* Left Column - 70% - Post Details */}
                <div className="md:w-8/12">
                {/* Caption Section */}
                {post?.post_description && (
                    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
                    <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        Caption
                    </h4>
                    <div className="p-3 bg-gray-50 rounded border border-gray-100">
                        <p className="text-gray-900 whitespace-pre-line">{post?.post_description}</p>
                    </div>
                    </div>
                )}

                {/* Platform Results */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2" />
                    </svg>
                    Platform Results
                    </h2>
                    <div className="overflow-x-auto">
                    {post?.isScheduled && post?.status === 'pending' ? (
                        <div className="text-center py-4 px-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-700">
                            This post is scheduled and has not been published yet. Results will appear here once it&apos;s processed.
                        </p>
                        </div>
                    ) : post?.platformResults && post.platformResults.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md">
                        <thead className="bg-gray-50">
                            <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Platform
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Account
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Post Link
                            </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {post.platformResults.map((platformResult, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                <PlatformIcon platform={platformResult?.platformName} />
                                <span className="ml-2 text-gray-900 capitalize">{platformResult?.platformName || ''}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                                {platformResult?.accountName || platformResult?.accountId || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <StatusBadge status={platformResult?.success ? 'success' : (platformResult?.errorDetails ? 'failed' : 'unknown')} />
                            </td>
                            <td className="px-4 py-3">
                                {platformResult?.success && platformResult?.postLink ? (
                                <a 
                                    href={platformResult.postLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-500 hover:text-blue-700 flex items-center"
                                >
                                    View Post
                                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                                ) : platformResult?.success && platformResult.platformName === 'tiktok' && platformResult.accountName ? (
                                  // Fallback for TikTok if postUrl is missing but username exists
                                  <a 
                                    href={`https://www.tiktok.com/@${platformResult.accountName}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-500 hover:text-blue-700 flex items-center"
                                  >
                                    View Profile
                                     <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                ) : !platformResult?.success && platformResult?.errorDetails ? (
                                <span className="text-red-500 text-xs" title={platformResult.errorDetails}>
                                    Failed: {platformResult.errorDetails.substring(0,30)}{platformResult.errorDetails.length > 30 ? '...' : ''}
                                </span>
                                ) : (
                                <span className="text-gray-500">No link available</span>
                                )}
                            </td>
                            </tr>
                        ))}
                        </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-4 px-3 bg-gray-50 border border-gray-200 rounded-md">
                          <p className="text-sm text-gray-600">
                            {post?.status === 'completed' ? 
                                'No platform results were found for this post.' : 
                                'This post is currently being processed, or results are not yet available.'
                            }
                          </p>
                        </div>
                    )}
                    </div>
                </div>
                </div>

                {/* Right Column - 30% - Video Thumbnail */}
                <div className="md:w-4/12">
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Video Content
                    </h2>
                    
                    {post?.video_url ? (
                      <>
                        <div className="bg-gray-100 rounded-lg p-4 mb-3 text-center cursor-pointer" onClick={() => setShowVideoPopup(true)}>
                          <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-600 text-sm">Media post</p>
                        </div>
                        
                        <div>
                          <button 
                              onClick={() => setShowVideoPopup(true)}
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded flex items-center justify-center"
                          >
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Watch Video
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="bg-gray-100 rounded-lg p-6 text-center">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-gray-600">Video not available</p>
                        <p className="text-gray-500 text-sm mt-1">The video for this post may have been removed or is no longer accessible.</p>
                      </div>
                    )}
                </div>
                </div>
            </div>
            </div>
        </div>
        </main>        
        {/* Video Popup */}
        <VideoPopup 
          videoUrl={post?.video_url} 
          onClose={() => setShowVideoPopup(false)} 
        />
      </div>
    </ProtectedRoute>
  );
}

export default function PostDetailsPage() {
  return (
    <ProtectedRoute>
      <PostDetails />
    </ProtectedRoute>
  );
} 