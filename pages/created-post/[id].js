import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { TikTokSimpleIcon, TwitterIcon } from '../../src/components/icons/SocialIcons';
import ProtectedRoute from '../../src/components/ProtectedRoute';

const API_URL = 'https://sociallane-backend.mindio.chat';

function PostDetails() {
  const router = useRouter();
  const { id } = router.query;
  
  const [post, setPost] = useState(null);
  const [postSummary, setPostSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch post details when ID is available
    if (id) {
      fetchPostDetails(id);
    }
  }, [id]);

  const fetchPostDetails = async (postId) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch post details
      const postResponse = await fetch(`${API_URL}/posts/${postId}`);
      if (!postResponse.ok) {
        throw new Error(`Failed to fetch post: ${postResponse.status} ${postResponse.statusText}`);
      }
      
      const postData = await postResponse.json();
      setPost(postData);
      
      // Try to fetch the post summary if it exists
      if (postData.summaryId) {
        try {
          const summaryResponse = await fetch(`${API_URL}/posts/summaries/${postData.summaryId}`);
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            setPostSummary(summaryData);
          }
        } catch (summaryError) {
          console.warn('Could not fetch post summary:', summaryError);
          // This isn't a fatal error, we can still show the post without the summary
        }
      }
    } catch (err) {
      console.error('Error fetching post details:', err);
      setError(err.message || 'Failed to load post details');
    } finally {
      setLoading(false);
    }
  };

  // Format a date for display
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

  // Get status badge based on post status
  const StatusBadge = ({ status }) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
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
        <div className="text-red-500 text-xl mb-4">Error: {error}</div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Return to Dashboard
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
  const processingResults = post.processing_results || {};

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>Post Details - Social Lane</title>
          <meta name="description" content="View details of your social media post" />
        </Head>

        <main className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Link href="/dashboard" className="text-blue-500 hover:text-blue-700 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <h1 className="text-xl font-semibold text-gray-900">Post Details</h1>
            </div>

            {/* Post Info */}
            <div className="px-6 py-4">
              <div className="flex flex-wrap gap-4 mb-6">
                <div>
                  <span className="block text-sm font-medium text-gray-500">Status</span>
                  <StatusBadge status={post.status} />
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-500">Created</span>
                  <span className="text-gray-900">{formatDate(post.createdAt || post.date)}</span>
                </div>
                {post.isScheduled && (
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Scheduled For</span>
                    <span className="text-gray-900">{formatDate(post.scheduledDate)}</span>
                  </div>
                )}
                <div>
                  <span className="block text-sm font-medium text-gray-500">Platforms</span>
                  <div className="flex space-x-2 mt-1">
                    {post.platforms.map(platform => (
                      <div key={platform} className="flex items-center">
                        <PlatformIcon platform={platform} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Video Preview */}
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-2">Content</h2>
                <div className="rounded-lg overflow-hidden bg-gray-100 p-4">
                  <div className="aspect-w-16 aspect-h-9 mb-4">
                    <video 
                      src={post.video_url} 
                      controls 
                      className="rounded object-contain w-full"
                    ></video>
                  </div>
                  
                  {post.post_description && (
                    <div className="mt-3">
                      <h3 className="font-medium text-gray-700 mb-1">Caption</h3>
                      <p className="text-gray-900">{post.post_description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Platform Results */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-2">Platform Results</h2>
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Post Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* Use data from postSummary if available, otherwise fallback to processing_results */}
                      {postSummary && postSummary.platformResults ? (
                        postSummary.platformResults.map((result, index) => (
                          <tr key={`summary-${index}`}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <PlatformIcon platform={result.platformName} />
                                <span className="ml-2 text-gray-900 capitalize">{result.platformName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                              {result.accountName || result.accountId || 'N/A'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusBadge status={result.success ? 'success' : 'failed'} />
                            </td>
                            <td className="px-4 py-3">
                              {result.postLink ? (
                                <a 
                                  href={result.postLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-500 hover:text-blue-700"
                                >
                                  View Post
                                </a>
                              ) : (
                                <span className="text-gray-500">
                                  {result.errorDetails || 'No link available'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        // Fallback to processing_results
                        Object.entries(processingResults).map(([platform, result], index) => {
                          // Handle different result formats
                          const results = Array.isArray(result) ? result : [result];
                          
                          return results.map((platformResult, i) => (
                            <tr key={`${platform}-${i}`}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <PlatformIcon platform={platform} />
                                  <span className="ml-2 text-gray-900 capitalize">{platform}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                                {platformResult.username || platformResult.accountId || 'N/A'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusBadge status={platformResult.success ? 'success' : 'failed'} />
                              </td>
                              <td className="px-4 py-3">
                                {/* TikTok and Twitter have different result formats */}
                                {platform === 'tiktok' && platformResult.success ? (
                                  platformResult.postUrl ? (
                                    <a 
                                      href={platformResult.postUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-500 hover:text-blue-700"
                                    >
                                      View Post
                                    </a>
                                  ) : (
                                    <span className="text-gray-500">View on Profile</span>
                                  )
                                ) : platform === 'twitter' && platformResult.success ? (
                                  // For Twitter, construct URL from tweet_id if available
                                  platformResult.tweet_id || (platformResult.data && platformResult.data.id) ? (
                                    <a 
                                      href={`https://twitter.com/${platformResult.username || 'user'}/status/${platformResult.tweet_id || platformResult.data.id}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-500 hover:text-blue-700"
                                    >
                                      View Tweet
                                    </a>
                                  ) : (
                                    <span className="text-gray-500">No link available</span>
                                  )
                                ) : (
                                  <span className="text-gray-500">
                                    {platformResult.error || 'Failed to post'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ));
                        })
                      )}

                      {/* Show message if no results are available */}
                      {(!postSummary || !postSummary.platformResults) && 
                       (!processingResults || Object.keys(processingResults).length === 0) && (
                        <tr>
                          <td colSpan="4" className="px-4 py-4 text-center text-gray-500">
                            No platform results available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>
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