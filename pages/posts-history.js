import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '../src/components/ProtectedRoute';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import { useAuth } from '../src/context/AuthContext';
import { HomeIcon } from '@heroicons/react/24/solid';

function PostsHistory() {
  const router = useRouter();
  const { user } = useAuth();
  
  // State management
  const [allPosts, setAllPosts] = useState([]); // Store all unfiltered posts
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isFetching, setIsFetching] = useState(false); // Add missing state for fetch status tracking
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const postsPerPage = 10;
  const [displayedTotalPosts, setDisplayedTotalPosts] = useState(0);
  const [backendTotalPages, setBackendTotalPages] = useState(1);
  
  // Add a cache to avoid duplicate API calls
  const [postCache, setPostCache] = useState({});

  // Filter states
  const [sortOrder, setSortOrder] = useState('newest');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [postTypeFilter, setPostTypeFilter] = useState('all');
  const [userId, setUserId] = useState('');
  
  // Get API URL from environment variable or use default
  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sociallane-backend.mindio.chat';

  useEffect(() => {
    // Get user ID from local storage
    const storedUserId = localStorage?.getItem('userId');
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  useEffect(() => {
    // Fetch posts when userId is available
    if (userId) {
      fetchPosts(currentPage);
    }
  }, [userId, currentPage]);
  
  const applyFilters = useCallback((postsData) => {
    let filteredPosts = [...postsData];
    
    // Filter by platform
    if (platformFilter !== 'all') {
      filteredPosts = filteredPosts.filter(post => 
        post.platforms?.includes(platformFilter)
      );
    }
    
    // Filter by post type (normal vs scheduled vs image vs video vs text)
    if (postTypeFilter !== 'all') {
      filteredPosts = filteredPosts.filter(post => {
        if (postTypeFilter === 'image') {
          return post.postType === 'image';
        } else if (postTypeFilter === 'video') {
          return post.postType === 'video';
        } else if (postTypeFilter === 'text') {
          return post.postType === 'text';
        }
        
        // For scheduled/normal posts (as before)
        // Convert values to boolean to handle string "true"/"false" 
        const isScheduledBool = post.isScheduled === true || post.isScheduled === "true";
        const hasScheduledDate = Boolean(post.scheduledDate);
        const isScheduledPost = isScheduledBool || hasScheduledDate;
        
        if (postTypeFilter === 'scheduled') {
          return isScheduledPost; 
        } else if (postTypeFilter === 'normal') {
          return !isScheduledPost;
        }
        return true;
      });
    }
    
    // Filter by time
    if (timeFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch(timeFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }
      
      filteredPosts = filteredPosts.filter(post => {
        const postDate = new Date(post.postDate || post.createdAt || post.date);
        return postDate >= filterDate;
      });
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
      const lowerStatusFilter = statusFilter.toLowerCase();
      filteredPosts = filteredPosts.filter(post => {
        const postStatus = post.status?.toLowerCase() || '';
        if (lowerStatusFilter === 'failed') {
          return postStatus === 'failed' || postStatus === 'failure';
        }
        return postStatus === lowerStatusFilter;
      });
    }
    
    // Sort posts
    filteredPosts.sort((a, b) => {
      const dateA = new Date(a.postDate || a.createdAt || a.date);
      const dateB = new Date(b.postDate || b.createdAt || b.date);
      
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return filteredPosts;
  }, [platformFilter, postTypeFilter, timeFilter, statusFilter, sortOrder]);

  // Apply filters when filter states change
  useEffect(() => {
    const isDataFilterActive =
      platformFilter !== 'all' ||
      timeFilter !== 'all' ||
      statusFilter !== 'all' ||
      postTypeFilter !== 'all';

    // applyFilters is called with allPosts, which is the unfiltered data for the current page
    const filteredOnPage = applyFilters(allPosts);
    setPosts(filteredOnPage); // Update displayed posts

    if (isDataFilterActive) {
      // Filters are active: pagination should reflect the count of items visible from the current filtered page data
      setTotalPages(Math.max(1, Math.ceil(filteredOnPage.length / postsPerPage)));
      setDisplayedTotalPosts(filteredOnPage.length);
    } else {
      // No filters active (or cleared): revert to backend's total pagination
      setTotalPages(backendTotalPages); // Use the stored backend total pages
      setDisplayedTotalPosts(totalPosts); // totalPosts is the overall total from backend
    }
  }, [
    sortOrder,
    platformFilter,
    timeFilter,
    statusFilter,
    postTypeFilter,
    allPosts, 
    postsPerPage,
    totalPosts, 
    backendTotalPages,
    applyFilters
  ]);

  const fetchPosts = async (page = 1) => {
    if (isFetching) return;
    
    setIsFetching(true);
    setError(null);
    
    try {
      // Fetch posts (both regular and processed scheduled posts) with pagination
      console.log(`Fetching posts history for page ${page}...`);
      const response = await fetch(`${API_URL}/posts/regular/${userId}?page=${page}&limit=${postsPerPage}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error fetching posts! Status: ${response.status}`);
      }
      
      const data = await response.json();
      const fetchedPosts = data.posts || [];
      console.log(`Fetched ${fetchedPosts.length} posts for history (page ${page})`);
      
      // If pagination data is available, update total counts
      if (data.pagination) {
        setTotalPosts(data.pagination.total || 0);
        const bPages = data.pagination.pages || 1;
        setTotalPages(bPages);
        setBackendTotalPages(bPages);
        setDisplayedTotalPosts(data.pagination.total || 0);
      } else {
        // Fallback to calculating based on current data
        const numFetched = fetchedPosts.length;
        setTotalPosts(numFetched);
        setTotalPages(1);
        setBackendTotalPages(1);
        setDisplayedTotalPosts(numFetched);
      }
      
      // Process the results
      const enhancedPosts = fetchedPosts.map(post => {
        // Determine if this is an image post
        const isImagePost = post.postType === 'image';
        
        // Normalize image URLs field
        let normalizedImageUrls = [];
        if (Array.isArray(post.imageUrls) && post.imageUrls.length > 0) {
          normalizedImageUrls = post.imageUrls;
        } else if (Array.isArray(post.image_urls) && post.image_urls.length > 0) {
          normalizedImageUrls = post.image_urls;
        }

        // If the post already has platformResults from the backend, ensure proper format
        if (post.platformResults && post.platformResults.length > 0) {
          // Make sure each platformResult has both platform and platformName properties
          const updatedPlatformResults = post.platformResults.map(result => ({
            ...result,
            platform: result.platform || result.platformName,
            platformName: result.platformName || result.platform
          }));
          
          return {
            ...post,
            platformResults: updatedPlatformResults,
            type: post.isScheduled ? 'scheduled' : 'regular',
            isImagePost: isImagePost,
            imageUrls: normalizedImageUrls,
            postType: post.postType,
            textContent: post.textContent
          };
        }
        
        // Otherwise create platformResults from processing_results
        const platformResults = [];
        
        // Check if processing_results exists and process them if it does
        if (post.processing_results) {
          Object.entries(post.processing_results).forEach(([platform, result]) => {
            const results = Array.isArray(result) ? result : [result];
            
            results.forEach(platformResult => {
              // Determine success based on platformResult.success or overall post status if completed
              const isSuccess = 
                platformResult?.success === true || 
                (post.status === 'completed');
              
              platformResults.push({
                platformName: platform,
                platform: platform,
                status: isSuccess ? 'success' : 'failed',
                success: isSuccess, // Add explicit success flag
                message: platformResult?.error || 'Processed',
                url: platformResult?.postUrl || '',
                accountName: platformResult?.username || platformResult?.accountName || '',
              });
            });
          });
        } else if (post.platforms && Array.isArray(post.platforms)) {
          // If no processing_results, create placeholder results from platforms
          post.platforms.forEach(platform => {
            // If post status is completed, consider all platforms successful
            const isSuccess = post.status === 'completed' || post.status === 'success';
            
            platformResults.push({
              platformName: platform,
              platform: platform,
              status: isSuccess ? 'success' : post.status,
              success: isSuccess, // Add explicit success flag
              message: isSuccess ? 'Processed' : post.status,
              url: '',
            });
          });
        }
        
        return {
          ...post,
          platformResults,
          type: post.isScheduled ? 'scheduled' : 'regular',
          isImagePost: isImagePost,
          imageUrls: normalizedImageUrls,
          postType: post.postType,
          textContent: post.textContent
        };
      });
      
      console.log(`Processed ${enhancedPosts.length} posts for display`);
      
      // Apply filters to posts
      let filteredPosts = applyFilters(enhancedPosts);
      console.log(`After filtering: ${filteredPosts.length} posts remain`);
      
      // Store posts in state and cache
      setAllPosts(enhancedPosts);
      setPosts(filteredPosts);
      postCache.allPosts = enhancedPosts;
      postCache.filteredPosts = filteredPosts;
      postCache.lastFetched = new Date().getTime();
      
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(`Failed to load posts: ${error.message}`);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (filterType, value) => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
    
    switch (filterType) {
      case 'sort':
        setSortOrder(value);
        break;
      case 'platform':
        setPlatformFilter(value);
        break;
      case 'time':
        setTimeFilter(value);
        break;
      case 'status':
        setStatusFilter(value);
        break;
      case 'postType':
        setPostTypeFilter(value);
        break;
      default:
        break;
    }
  };

  // Format date to readable string
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
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

  // Format date with only day/month/year
  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  };

  // Get status badge based on post status
  const StatusBadge = ({ status }) => {
    const baseClasses = "px-2.5 py-0.5 rounded-full text-xs font-medium";
    let color = "";
    
    switch(status?.toLowerCase()) {
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

  // Render platform icons
  const renderPlatformIcons = (platforms) => {
    if (!platforms || platforms.length === 0) return <span className="text-gray-400">-</span>;
    
    // Create a unique set of platforms
    const uniquePlatforms = new Set();
    platforms.forEach(platform => {
      const platformName = typeof platform === 'string' ? platform : platform.platformName || platform.platform;
      if (platformName) {
        uniquePlatforms.add(platformName);
      }
    });
    
    return (
      <div className="flex space-x-2">
        {Array.from(uniquePlatforms).map((platform, index) => (
          <div key={index} className="flex items-center">
            <div className="relative text-gray-800">
              <PlatformIcon platform={platform} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render platform results with success/failure indicator
  const renderPlatformResults = (platformResults, postStatus) => {
    if (!platformResults || platformResults.length === 0) {
      return <span className="text-gray-400">-</span>;
    }
    
    // Group results by platform and determine success status for each platform
    const platformStatusMap = {};
    
    platformResults.forEach(result => {
      const platform = result.platformName || result.platform;
      if (!platform) return;
      
      const currentSuccess = 
        result.status === 'success' || 
        result.success === true || 
        (result.status === undefined && result.success) ||
        (platform && postStatus === 'completed');
      
      // If this is the first occurrence of the platform, set its status
      if (!platformStatusMap[platform]) {
        platformStatusMap[platform] = { success: currentSuccess };
      } else if (!currentSuccess) {
        // If any account for this platform failed, mark the platform as failed
        platformStatusMap[platform].success = false;
      }
    });
    
    // Render a single icon per platform
    return (
      <div className="flex space-x-2">
        {Object.entries(platformStatusMap).map(([platform, { success }], index) => (
          <div key={index} className="flex items-center" title={`${platform}: ${success ? 'Success' : 'Failed'}`}>
            <div className={`relative ${success ? 'text-blue-600' : 'text-blue-200'}`}>
              <PlatformIcon platform={platform} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Filter dropdowns
  const FilterDropdown = ({ label, value, onChange, options }) => (
    <div className="flex items-center space-x-2">
      <label className="text-sm text-gray-600">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-md text-sm py-1 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  // Helper to get the correct post ID for links
  const getPostDetailLink = (post) => {
    if (!post) return "/dashboard";
    
    // Find the best ID to use (try different fields)
    const idToUse = post.postId || post._id;
    
    if (!idToUse) {
      console.warn('No valid ID found for post detail link');
      return "/dashboard";
    }
    
    return `/created-post/${idToUse}`;
  };

  if (loading && posts.length === 0) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Posts History - Social Lane</title>
      </Head>
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-white">
        <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 pt-5">
              <div className="flex items-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
                  Posts History
                </h1>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 pb-4">
              View and filter all your previous posts.
            </p>
          </div>
        </header>

        <main className="container mx-auto p-4 sm:p-6 lg:p-8">
          {/* Filter and Sort Controls */}
          <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg shadow">
            <div className="flex flex-wrap gap-4">
              <FilterDropdown 
                label="Sort" 
                value={sortOrder}
                onChange={(value) => handleFilterChange('sort', value)}
                options={[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'oldest', label: 'Oldest First' }
                ]}
              />
              
              <FilterDropdown 
                label="Platform" 
                value={platformFilter}
                onChange={(value) => handleFilterChange('platform', value)}
                options={[
                  { value: 'all', label: 'All Platforms' },
                  { value: 'tiktok', label: 'TikTok' },
                  { value: 'twitter', label: 'Twitter/X' }
                ]}
              />
              
              <FilterDropdown 
                label="Time" 
                value={timeFilter}
                onChange={(value) => handleFilterChange('time', value)}
                options={[
                  { value: 'all', label: 'All Time' },
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'This Week' },
                  { value: 'month', label: 'This Month' }
                ]}
              />
              
              <FilterDropdown 
                label="Status" 
                value={statusFilter}
                onChange={(value) => handleFilterChange('status', value)}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'partial', label: 'Partial' },
                  { value: 'failed', label: 'Failed' }
                ]}
              />
              
              <FilterDropdown 
                label="Post Type" 
                value={postTypeFilter}
                onChange={(value) => handleFilterChange('postType', value)}
                options={[
                  { value: 'all', label: 'All Posts' },
                  { value: 'normal', label: 'Instant Posts' },
                  { value: 'scheduled', label: 'Scheduled Posts' },
                  { value: 'image', label: 'Image Posts' },
                  { value: 'video', label: 'Video Posts' },
                  { value: 'text', label: 'Text Posts' }
                ]}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Loading indicator for post details */}
          {loadingDetails && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6 flex items-center">
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
              Loading post details...
            </div>
          )}

          {/* Posts Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platforms
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {posts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                        {loading ? 'Loading posts...' : 'No posts found'}
                      </td>
                    </tr>
                  ) : (
                    posts.map((post, index) => {
                      // Handle different data formats for isScheduled field
                      const isScheduledBool = post.isScheduled === true || post.isScheduled === "true";
                      const hasScheduledDate = Boolean(post.scheduledDate);
                      const isScheduledPost = isScheduledBool || hasScheduledDate;
                      
                      // Debug log to help identify issues
                      console.log(`Post ${post._id || post.postId} data:`, { 
                        isScheduled: post.isScheduled,
                        status: post.status,
                        hasPlatforms: !!post.platforms,
                        platforms: post.platforms,
                        hasPlatformResults: !!post.platformResults,
                        platformResults: post.platformResults?.length
                      });
                      
                      return (
                        <tr key={post._id} className={`hover:bg-yellow-50 ${index % 2 === 1 ? 'bg-indigo-50/20' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(post.postDate || post.createdAt || post.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {post.platformResults && post.platformResults.length > 0 ? 
                              renderPlatformResults(post.platformResults, post.status) : 
                              renderPlatformIcons(post.platforms)
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={post.status || 'unknown'} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {isScheduledPost ? (
                              <div className="flex items-center text-indigo-600">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {formatDateShort(post.scheduledDate)}
                              </div>
                            ) : (
                              <div className="text-gray-500 flex items-center">
                                <span className="mr-2">⚡️</span>
                                <span className="flex items-center mr-2">
                                  {post.postType === 'image' ? (
                                    <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  ) : post.postType === 'video' ? (
                                    <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  ) : post.postType === 'text' ? (
                                    <svg className="w-4 h-4 text-gray-700 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                  ) : null }
                                  {post.postType === 'image' ? 
                                    (post.imageUrls && post.imageUrls.length > 1 ? `${post.imageUrls.length} images` : 'Image') : 
                                   post.postType === 'video' ? 'Video' :
                                   post.postType === 'text' ? 'Text' :
                                   'Media' // Fallback for older posts or unknown types
                                  }
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {post._id && (
                              <Link href={getPostDetailLink(post)} className="text-blue-500 hover:text-blue-700">
                                View Details
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination and Post Count */}
            <div className="px-6 py-4 flex justify-between items-center border-t border-gray-200">
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded border ${
                    currentPage === 1 
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Previous
                </button>
                
                <div className="flex items-center space-x-1">
                  {[...Array(totalPages).keys()].map(i => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        currentPage === i + 1
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  )).slice(0, 5)} {/* Show max 5 page buttons */}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="px-1">...</span>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-gray-700 hover:bg-gray-50"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded border ${
                    currentPage === totalPages 
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Next
                </button>
              </div>
              
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{posts.length}</span> of <span className="font-medium">{displayedTotalPosts}</span> posts
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default PostsHistory; 