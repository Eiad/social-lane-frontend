import { useState, useEffect, useRef, useMemo } from 'react';
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
  const [showMediaPopup, setShowMediaPopup] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const fetchedRef = useRef(false);

  // Helper to determine if this is an image post
  const isImagePost = useMemo(() => {
    if (!post) return false;
    return post.postType === 'image'; // Use postType
  }, [post]);

  // Helper to determine if this is a video post
  const isVideoPost = useMemo(() => {
    if (!post) return false;
    return post.postType === 'video';
  }, [post]);

  // Helper to determine if this is a text post
  const isTextPost = useMemo(() => {
    if (!post) return false;
    return post.postType === 'text';
  }, [post]);

  // Function to get thumbnail image for display
  const getThumbnailImage = useMemo(() => {
    if (!post) return null;
    if (isImagePost && post.imageUrls && post.imageUrls.length > 0) {
      return post.imageUrls[0];
    }
    if (isVideoPost && post.video_url) { // Check if it's a video post
        // Prefer a thumbnail URL if available (e.g., from R2 metadata or a specific field)
        // For now, if no explicit thumbnail, we might not show one or use a placeholder
        // Depending on how video_url is structured, it might itself be a previewable link or require processing.
        // Let's assume for now video_url might be directly usable or we add a specific thumbnail field later.
        return post.video_thumbnail || post.video_url; // Prefer a specific thumbnail if available
    }
    return null; // No thumbnail for text posts or if media is missing
  }, [post, isImagePost, isVideoPost]);

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
        if (result.success && result.id) {
          postLink = `https://twitter.com/${result.username || 'user'}/status/${result.id}`;
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
      
      // Process and normalize post data
      const processedPost = {
        ...postData,
        postType: postData.postType || 'video', // Default to video for older posts
        textContent: postData.textContent || '' // Ensure textContent exists
      };

      // Handle image URLs - check different properties where they might be stored
      if (Array.isArray(postData.imageUrls) && postData.imageUrls.length > 0) {
        processedPost.imageUrls = postData.imageUrls;
      } else if (Array.isArray(postData.image_urls) && postData.image_urls.length > 0) {
        processedPost.imageUrls = postData.image_urls;
      } else if (postData.video_url && (
        postData.video_url.endsWith('.jpg') || 
        postData.video_url.endsWith('.jpeg') || 
        postData.video_url.endsWith('.png') || 
        postData.video_url.endsWith('.gif')
      )) {
        // Handle case where image was mistakenly stored in video_url
        processedPost.imageUrls = [postData.video_url];
      } else {
        processedPost.imageUrls = [];
      }
      
      // Enhance post data with platformResults derived from processing_results
      if (postData.processing_results) {
        processedPost.platformResults = preparePlatformResults(postData.processing_results);
      }
      
      setPost(processedPost);
      
      // Cache the post data in memory
      postCache[postId] = {
        post: processedPost,
        timestamp: Date.now()
      };
      
      // Also cache in localStorage for persistence between page reloads
      const allCache = getLocalStorageCache();
      saveToLocalStorage(allCache, postId, processedPost);
      
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

  // Media Popup Component
  const MediaPopup = ({ mediaUrl, imageUrls, postType, textContent, onClose, isOpen }) => {
    const [videoError, setVideoError] = useState(false);
    const [videoLoading, setVideoLoading] = useState(true);
    const [blobUrl, setBlobUrl] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [videoKey, setVideoKey] = useState(Date.now()); // Used to force re-render of video

    useEffect(() => {
      let objectUrl;
      // Ensure blob fetching logic runs only for video posts when the popup is open
      if (isOpen && postType === 'video' && mediaUrl) {
        setVideoError(false);
        setVideoLoading(true);
        setBlobUrl(null); // Reset blob Url

        fetch(mediaUrl)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
            }
            return response.blob();
          })
          .then(blob => {
            objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
            setVideoLoading(false);
          })
          .catch(err => {
            console.error('Error fetching video for blob URL:', err);
            setVideoError(true);
            setVideoLoading(false);
          });
      }

      return () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          setBlobUrl(null);
        }
      };
    }, [isOpen, mediaUrl, postType]); // Updated dependency array

    const handleVideoError = () => {
      setVideoError(true);
      setVideoLoading(false);
    };

    const handleVideoLoad = () => {
      setVideoLoading(false);
    };
    
    const nextImage = () => {
      if (isImagePost && imageUrls.length > 1) {
        setCurrentImageIndex((prevIndex) => 
          prevIndex === imageUrls.length - 1 ? 0 : prevIndex + 1
        );
      }
    };
    
    const prevImage = () => {
      if (isImagePost && imageUrls.length > 1) {
        setCurrentImageIndex((prevIndex) => 
          prevIndex === 0 ? imageUrls.length - 1 : prevIndex - 1
        );
      }
    };
    
    if (!isOpen) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-medium text-lg">Media Preview</h3>
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
            {postType === 'image' && imageUrls && imageUrls.length > 0 ? (
              <div className="relative aspect-w-16 aspect-h-9 flex items-center justify-center">
                <img 
                  src={imageUrls[currentImageIndex]} 
                  alt={`Image ${currentImageIndex + 1}`}
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
                {imageUrls.length > 1 && (
                  <>
                    <button 
                      onClick={prevImage}
                      className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 p-2 rounded-r-md text-white hover:bg-opacity-70"
                      aria-label="Previous image"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button 
                      onClick={nextImage}
                      className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 p-2 rounded-l-md text-white hover:bg-opacity-70"
                      aria-label="Next image"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full text-sm">
                      {currentImageIndex + 1} / {imageUrls.length}
                    </div>
                  </>
                )}
              </div>
            ) : postType === 'video' && mediaUrl ? (
              <video 
                key={videoKey} // Force re-render on error/retry
                src={blobUrl || mediaUrl}
                controls 
                autoPlay
                onError={handleVideoError}
                onLoadedData={handleVideoLoad}
                className="rounded object-contain w-full max-h-[80vh]"
              >
                Your browser does not support the video tag.
              </video>
            ) : postType === 'text' && textContent ? (
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Text Content</h4>
                <p className="text-gray-700 whitespace-pre-line">{textContent}</p>
              </div>
            ) : (
              <div className="aspect-w-16 aspect-h-9 bg-gray-100 flex flex-col items-center justify-center p-4 rounded">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-700 font-medium mb-1">No media available</p>
                <p className="text-gray-500 text-sm text-center">The media URL is missing or invalid.</p>
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
                    <span className="text-gray-900 text-[14px]">{formatDate(post?.createdAt || post?.date)}</span>
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
                {/* Left Column - Post Details */}
                <div className={isTextPost ? "w-full" : "md:w-8/12"}>
                {/* Text Content Section (for text posts) */}
                {isTextPost && post?.textContent && (
                    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
                    <h4 className=" text-[15px] text-gray-700 mb-2 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        Text Content
                    </h4>
                    <div className="p-3 bg-gray-50 rounded border border-gray-100">
                        <p className="text-gray-900 whitespace-pre-line">{post?.textContent}</p>
                    </div>
                    </div>
                )}

                {/* Caption Section */}
                {post?.post_description && (
                    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
                    <h4 className=" text-[15px] text-gray-700 mb-2 flex items-center">
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
                    <h2 className="text-lg  text-[15px] text-gray-900 mb-4 flex items-center">
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
                          <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} text-[12px]`}>
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
                                    <span>View Post</span>
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

                {/* Right Column - Media Preview & Info - Conditionally render only if NOT a text post */}
                {!isTextPost && (
                  <div className="md:w-4/12 mt-6 md:mt-0">
                      {/* Media Preview Section - only for image or video posts */}
                      {post && (isImagePost || isVideoPost) && (
                          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm mb-6">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Media Preview</h4>
                              <div
                                  className="relative aspect-video bg-gray-100 rounded-md overflow-hidden cursor-pointer group hover:shadow-lg transition-shadow duration-200"
                                  onClick={() => { if(post && (isImagePost || isVideoPost)) setShowMediaPopup(true); }}
                              >
                                  {/* Video Post Preview */}
                                  {isVideoPost && (
                                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200">
                                          <svg className="w-12 h-12 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                          </svg>
                                          <p className="mt-1 text-xs text-slate-600">Video</p>
                                      </div>
                                  )}

                                  {/* Image Post Preview */}
                                  {isImagePost && post.imageUrls && post.imageUrls.length > 0 && (
                                      <img
                                          src={post.imageUrls[0]}
                                          alt="Post image preview"
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                              // Fallback for broken image link
                                              const placeholderContainer = e.target.parentElement;
                                              if (placeholderContainer) {
                                                  e.target.style.display = 'none'; // Hide broken img
                                                  // Check if placeholder already exists
                                                  if (!placeholderContainer.querySelector('.image-load-error-placeholder')) {
                                                      const placeholder = document.createElement('div');
                                                      placeholder.className = "image-load-error-placeholder w-full h-full flex flex-col items-center justify-center bg-slate-200";
                                                      placeholder.innerHTML = `
                                                          <svg class="w-12 h-12 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                                          </svg>
                                                          <p class="mt-1 text-xs text-slate-600">Preview unavailable</p>`;
                                                      placeholderContainer.appendChild(placeholder);
                                                  }
                                              }
                                          }}
                                      />
                                  )}
                                  {isImagePost && (!post.imageUrls || post.imageUrls.length === 0) && (
                                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200">
                                          <svg className="w-12 h-12 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                          </svg>
                                          <p className="mt-1 text-xs text-slate-600">No Image Preview</p>
                                      </div>
                                  )}

                                  {/* Overlay "View Media" Button */}
                                  {post && (isImagePost || isVideoPost) && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200">
                                          <button
                                              className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition duration-150 ease-in-out flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                                          >
                                              {isImagePost && (
                                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                              )}
                                              {isVideoPost && (
                                                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M6.323 5.682A1.5 1.5 0 004 7.028v5.944a1.5 1.5 0 002.323 1.346l5.432-2.972a1.5 1.5 0 000-2.692L6.323 5.682zM0 10a10 10 0 1120 0A10 10 0 010 10z" clipRule="evenodd" fillRule="evenodd"  /></svg>
                                              )}
                                              View Media {isImagePost && post.imageUrls && post.imageUrls.length > 1 ? `(${post.imageUrls.length})` : ''}
                                          </button>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
                )}
            </div>
            </div>
        </div>
        </main>        
        {/* Media Popup */}
        {showMediaPopup && (
          <MediaPopup 
            mediaUrl={post?.video_url}
            imageUrls={post?.imageUrls}
            postType={post?.postType}
            textContent={post?.textContent}
            onClose={() => setShowMediaPopup(false)} 
            isOpen={showMediaPopup} 
          />
        )}
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