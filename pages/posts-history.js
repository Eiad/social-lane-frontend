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
    
    // Filter by post type (normal vs scheduled)
    if (postTypeFilter !== 'all') {
      filteredPosts = filteredPosts.filter(post => {
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
            type: post.isScheduled ? 'scheduled' : 'regular'
          };
        }
        
        // Otherwise create platformResults from processing_results
        const platformResults = [];
        
        // Check if processing_results exists and process them if it does
        if (post.processing_results) {
          Object.entries(post.processing_results).forEach(([platform, result]) => {
            const results = Array.isArray(result) ? result : [result];
            
            results.forEach(platformResult => {
              platformResults.push({
                platformName: platform,
                platform: platform,
                status: platformResult?.success ? 'success' : 'failed',
                message: platformResult?.error || 'Processed',
                url: platformResult?.postUrl || '',
                accountName: platformResult?.username || platformResult?.accountName || '',
              });
            });
          });
        } else if (post.platforms && Array.isArray(post.platforms)) {
          // If no processing_results, create placeholder results from platforms
          post.platforms.forEach(platform => {
            platformResults.push({
              platformName: platform,
              platform: platform,
              status: post.status === 'completed' ? 'success' : post.status,
              message: post.status === 'completed' ? 'Processed' : post.status,
              url: '',
            });
          });
        }
        
        return {
          ...post,
          platformResults,
          type: post.isScheduled ? 'scheduled' : 'regular'
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
    
    return (
      <div className="flex space-x-2">
        {platforms.map((platform, index) => (
          <div key={index} className="flex items-center">
            <PlatformIcon platform={typeof platform === 'string' ? platform : platform.platformName || platform.platform} />
          </div>
        ))}
      </div>
    );
  };

  // Render platform results with success/failure indicator
  const renderPlatformResults = (platformResults) => {
    if (!platformResults || platformResults.length === 0) {
      return <span className="text-gray-400">-</span>;
    }
    
    return (
      <div className="flex space-x-2">
        {platformResults.map((result, index) => (
          <div key={index} className="flex items-center" title={`${result.platformName || result.platform}: ${result.status === 'success' ? 'Success' : 'Failed'}`}>
            <div className={`relative ${result.status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              <PlatformIcon platform={result.platformName || result.platform} />
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
                  { value: 'normal', label: 'Normal Posts' },
                  { value: 'scheduled', label: 'Scheduled Posts' }
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
                    posts.map((post) => {
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
                        <tr key={post._id} className={`hover:bg-gray-50 ${isScheduledPost ? 'bg-indigo-50/20' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(post.postDate || post.createdAt || post.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {post.platformResults && post.platformResults.length > 0 ? 
                              renderPlatformResults(post.platformResults) : 
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {formatDateShort(post.scheduledDate)}
                              </div>
                            ) : (
                              <span className="text-gray-500">Not Scheduled</span>
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