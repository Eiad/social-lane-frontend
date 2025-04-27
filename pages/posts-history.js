import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '../src/components/ProtectedRoute';
import { TikTokSimpleIcon, TwitterIcon } from '../src/components/icons/SocialIcons';
import { useAuth } from '../src/context/AuthContext';

const API_URL = 'https://sociallane-backend.mindio.chat';

function PostsHistory() {
  const router = useRouter();
  const { user } = useAuth();
  
  // State management
  const [allPosts, setAllPosts] = useState([]); // Store all unfiltered posts
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Add a cache to avoid duplicate API calls
  const [postCache, setPostCache] = useState({});

  // Filter states
  const [sortOrder, setSortOrder] = useState('newest');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [postTypeFilter, setPostTypeFilter] = useState('all');

  // Load posts only when user changes or on initial load
  useEffect(() => {
    if (user?.uid) {
      fetchPosts();
    }
  }, [user?.uid]);
  
  // Apply filters when filter states change
  useEffect(() => {
    if (allPosts.length > 0) {
      const filteredPosts = applyFilters(allPosts);
      setPosts(filteredPosts);
    }
  }, [sortOrder, platformFilter, timeFilter, statusFilter, postTypeFilter, allPosts]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      // Try to get data from localStorage - single cache for everything
      let cachedData = null;
      const cacheKey = `posts-history-${user.uid}`;
      
      try {
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
          const parsedCache = JSON.parse(cachedItem);
          // Check if cache is less than 1 hour old
          if (parsedCache.timestamp && (Date.now() - parsedCache.timestamp < 60 * 60 * 1000)) {
            cachedData = parsedCache.data;
            console.log('Using cached posts data');
          } else {
            console.log('Cache expired');
          }
        }
      } catch (cacheError) {
        console.warn('Error reading from cache:', cacheError);
      }
      
      // If we have valid cached data, use it
      if (cachedData && cachedData.length > 0) {
        setAllPosts(cachedData);
        const filteredPosts = applyFilters(cachedData);
        setPosts(filteredPosts);
        setLoading(false);
        return;
      }

      // Fetch posts from API using the correct endpoint with userId
      const response = await fetch(`${API_URL}/posts/summaries/user/${user.uid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`);
      }
      
      let responseData = await response.json();
      let postsData = responseData.summaries || [];
      
      console.log('Posts summaries received:', postsData.length);

      // Use summaries directly instead of fetching individual post details
      // This reduces API calls significantly and avoids rate limits
      const enhancedPosts = postsData.map(summary => {
        // Extract post type info from summary data
        const isScheduled = 
          summary.isScheduled === true || 
          summary.isScheduled === "true" || 
          Boolean(summary.scheduledDate);
        
        return {
          ...summary,
          // Ensure these fields are always available
          isScheduled: isScheduled,
          postId: summary.postId || summary._id,
          _id: summary._id || summary.postId
        };
      });
      
      // If we need additional post details that aren't in the summaries,
      // fetch them in batches to avoid overwhelming the API
      if (enhancedPosts.length > 0) {
        try {
          // Significantly reduce the number of posts we fetch details for to avoid rate limits
          const postsToFetch = enhancedPosts.slice(0, 5).map(post => post.postId).filter(Boolean);
          console.log('Fetching additional details for posts:', postsToFetch);
          
          if (postsToFetch.length > 0) {
            // Use sequential fetching with delays instead of parallel to avoid rate limits
            for (const postId of postsToFetch) {
              try {
                const response = await fetch(`${API_URL}/posts/${postId}`);
                
                if (response.status === 429) {
                  console.warn('Rate limit reached, stopping additional requests');
                  break;
                }
                
                if (response.ok) {
                  const postData = await response.json();
                  
                  const postIndex = enhancedPosts.findIndex(p => 
                    p.postId === postData._id.toString() || p._id === postData._id.toString()
                  );
                  
                  if (postIndex !== -1) {
                    // Update post with scheduling information from the main post data
                    enhancedPosts[postIndex] = {
                      ...enhancedPosts[postIndex],
                      isScheduled: postData.isScheduled === true || postData.isScheduled === "true",
                      scheduledDate: postData.scheduledDate || enhancedPosts[postIndex].scheduledDate
                    };
                  }
                }
                
                // Add a small delay between requests to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 300));
              } catch (error) {
                console.warn(`Error fetching details for post ${postId}:`, error);
              }
            }
          }
        } catch (detailsError) {
          console.warn('Error fetching additional post details:', detailsError);
          // Continue with the data we have - this is not a fatal error
        }
      }
      
      // Store all unfiltered posts
      setAllPosts(enhancedPosts);
      
      // Save enhanced posts to localStorage - all data in one cache entry
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: enhancedPosts,
          timestamp: Date.now()
        }));
      } catch (saveCacheError) {
        console.warn('Error saving posts to cache:', saveCacheError);
      }
      
      // Apply filters
      const filteredPosts = applyFilters(enhancedPosts);
      setPosts(filteredPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (filterType, value) => {
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

  const applyFilters = (postsData) => {
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
      filteredPosts = filteredPosts.filter(post => 
        post.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }
    
    // Sort posts
    filteredPosts.sort((a, b) => {
      const dateA = new Date(a.postDate || a.createdAt || a.date);
      const dateB = new Date(b.postDate || b.createdAt || b.date);
      
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return filteredPosts;
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
        {platforms.map(platform => (
          <div key={platform} className="flex items-center">
            <PlatformIcon platform={platform} />
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
          <div key={index} className="flex items-center" title={`${result.platformName}: ${result.success ? 'Success' : 'Failed'}`}>
            <div className={`relative ${result.success ? 'text-green-500' : 'text-red-500'}`}>
              <PlatformIcon platform={result.platformName} />
              {!result.success && (
                <div className="absolute -top-1 -right-1 text-red-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
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
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>Posts History - Social Lane</title>
          <meta name="description" content="View your post history" />
        </Head>

        <main className="container mx-auto px-4 py-8">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Posts History</h1>
              <p className="text-gray-600">View and filter all your previous posts</p>
            </div>
            <Link href="/dashboard" className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded border border-gray-300 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
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
                  { value: 'success', label: 'Success' },
                  { value: 'failed', label: 'Failed' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'processing', label: 'Processing' },
                  { value: 'partial', label: 'Partial' }
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
                      console.log(`Post ${post._id || post.postId} scheduled status:`, { 
                        isScheduled: post.isScheduled, 
                        hasDate: !!post.scheduledDate,
                        scheduledDate: post.scheduledDate,
                        isScheduledPost
                      });
                      
                      return (
                        <tr key={post._id} className={`hover:bg-gray-50 ${isScheduledPost ? 'bg-indigo-50/20' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(post.postDate || post.createdAt || post.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {post.platformResults ? 
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
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default PostsHistory; 