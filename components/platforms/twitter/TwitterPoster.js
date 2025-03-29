import React from 'react';

// Define the API base URL properly - for the frontend API routes
const API_BASE_URL = '/api';
// The backend URL is only used for logging purposes
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

const TwitterPoster = {
  // Post to Twitter - handles both immediate and scheduled posts
  postToTwitter: async ({
    selectedTwitterAccounts,
    videoUrl,
    caption,
    firebaseUid,
    isScheduled,
    scheduledAt,
  }) => {
    console.log(`Posting to ${selectedTwitterAccounts?.length || 0} Twitter accounts...`, {
      accountDetails: selectedTwitterAccounts?.map(acc => ({
        userId: acc.userId,
        username: acc.username || 'no username'
      })),
      hasVideoUrl: !!videoUrl,
      hasCaption: !!caption,
      captionLength: caption?.length || 0,
      firebaseUid: firebaseUid?.substring(0, 5) + '...' || 'missing',
      isScheduled: !!isScheduled,
      hasScheduledAt: !!scheduledAt
    });
    
    let twitterResults = [];
    
    // Enhanced fetch with timeout and retry
    const fetchWithTimeoutAndRetry = async (url, options, timeout = 300000, maxRetries = 3) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          console.log(`Twitter API attempt ${attempt}/${maxRetries} to ${url}`);
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          lastError = error;
          console.error(`Twitter API attempt ${attempt} failed:`, error?.message || error);
          
          if (attempt < maxRetries) {
            const delay = 2000 * Math.pow(2, attempt - 1);
            console.log(`Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw lastError || new Error('All retry attempts failed');
    };
    
    // Special handler for possible CORS or network issues
    const handleNetworkError = (error) => {
      console.error('Network or CORS error when posting to Twitter:', error);
      return {
        error: 'Network connection issue. Please try again.',
        details: error?.message || 'Unknown error',
        isNetworkError: true
      };
    };
    
    if (isScheduled && scheduledAt) {
      // Handle scheduled posts
      console.log('Scheduling Twitter post for', scheduledAt);
      
      try {
        // Use the enhanced fetch with timeout and retry for scheduling
        const schedulePayload = {
          userId: firebaseUid,
          video_url: videoUrl,
          post_description: caption,
          platforms: ['twitter'],
          twitter_accounts: selectedTwitterAccounts.map(account => ({
            userId: account.userId,
            username: account.username || ''
          })),
          isScheduled: true,
          scheduledDate: scheduledAt.toISOString()
        };
        
        console.log('Sending Twitter schedule payload:', schedulePayload);
        console.log('Using API URL:', `${API_BASE_URL}/schedules`);
        
        const scheduleResponse = await fetchWithTimeoutAndRetry(
          `${API_BASE_URL}/schedules`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Timestamp': Date.now(), // Add timestamp to prevent caching
            },
            body: JSON.stringify(schedulePayload),
          },
          180000, // 3 minute timeout for scheduling
          3       // 3 retry attempts
        );
        
        let scheduleData;
        let scheduleError = null;
        
        try {
          // First check if the response is valid
          const contentType = scheduleResponse?.headers?.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              scheduleData = await scheduleResponse.json();
            } catch (jsonError) {
              console.error('Error parsing JSON from Twitter schedule API:', jsonError);
              scheduleError = 'Invalid JSON in schedule server response';
              scheduleData = { error: scheduleError };
            }
          } else {
            // Handle non-JSON responses (like HTML error pages)
            try {
              const text = await scheduleResponse.text();
              console.error('Non-JSON response from Twitter schedule API:', text.substring(0, 500));
              scheduleError = `Invalid response from schedule server (${scheduleResponse?.status || 'unknown status'})`;
              scheduleData = { error: scheduleError };
            } catch (textError) {
              console.error('Error reading schedule response text:', textError);
              scheduleError = 'Failed to read schedule server response';
              scheduleData = { error: scheduleError };
            }
          }
        } catch (error) {
          console.error('Error processing Twitter schedule API response:', error);
          scheduleError = 'Failed to process schedule server response';
          scheduleData = { error: scheduleError };
        }
        
        if (scheduleResponse?.ok && !scheduleError) {
          twitterResults = selectedTwitterAccounts.map(account => ({
            username: account.username || account.userId, 
            success: true, 
            message: 'Post scheduled successfully'
          }));
        } else {
          // Handle specific error codes for better user feedback
          if (scheduleResponse?.status === 400 && scheduleData?.error?.includes('validate')) {
            throw new Error('Invalid scheduling data: Please check your caption and try again');
          } else if (scheduleResponse?.status === 401) {
            throw new Error('Authentication failed: Please reconnect your Twitter account');
          } else if (scheduleResponse?.status === 413) {
            throw new Error('Video file is too large: Try compressing the video or reducing its duration');
          } else if (scheduleResponse?.status === 429) {
            throw new Error('Too many requests: Please wait a few minutes and try again');
          } else if (scheduleResponse?.status === 502 || scheduleResponse?.status === 504) {
            throw new Error('Server gateway timeout: The video may be too large or the server is busy, please try again');
          } else {
            throw new Error(scheduleData?.error || scheduleError || 'Failed to schedule Twitter post');
          }
        }
      } catch (error) {
        console.error('Error scheduling Twitter post:', error);
        
        // Generate detailed error messages for each account
        twitterResults = selectedTwitterAccounts.map(account => ({
          username: account.username || account.userId, 
          success: false, 
          error: error?.message || 'Failed to schedule post'
        }));
        
        // Still throw the error to be handled by the main component
        throw error;
      }
    } else {
      // Handle immediate posts to multiple Twitter accounts using the new endpoint
      console.log('Sending immediate Twitter post for multiple accounts');
      
      // Create Twitter payload with accounts array
      const twitterPayload = {
        userId: firebaseUid,
        videoUrl: videoUrl,
        text: caption,
        accounts: selectedTwitterAccounts.map(account => ({
          userId: account.userId,
          username: account.username || ''
        }))
      };
      
      console.log('Twitter post payload:', twitterPayload);
      console.log('Using Next.js API route:', `${API_BASE_URL}/twitter/post`);
      
      try {
        // Use enhanced fetch with longer timeout and retry logic
        const response = await fetchWithTimeoutAndRetry(
          `${API_BASE_URL}/twitter/post`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Timestamp': Date.now(), // Add timestamp to prevent caching
            },
            body: JSON.stringify(twitterPayload),
          },
          300000, // 5 minute timeout for multiple Twitter posts
          3       // 3 retry attempts
        ).catch(error => {
          console.error('Fetch error in Twitter posting:', error);
          throw error;
        });
        
        let data;
        let responseError = null;
        
        try {
          // First check if the response is valid
          const contentType = response?.headers?.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              data = await response.json();
            } catch (jsonError) {
              console.error('Error parsing JSON from Twitter API:', jsonError);
              responseError = 'Invalid JSON in server response';
              data = { error: responseError };
            }
          } else {
            // Handle non-JSON responses (like HTML error pages)
            try {
              const text = await response.text();
              console.error('Non-JSON response from Twitter API:', text.substring(0, 500));
              
              // If the response contains certain Twitter-specific success indicators, consider it a success
              if (text.includes('success') || text.includes('posted successfully')) {
                data = { 
                  success: true, 
                  message: 'Posted successfully (non-standard response format)'
                };
              } else {
                responseError = `Invalid response from server (${response?.status || 'unknown status'})`;
                data = { error: responseError };
              }
            } catch (textError) {
              console.error('Error reading response text:', textError);
              responseError = 'Failed to read server response';
              data = { error: responseError };
            }
          }
        } catch (error) {
          console.error('Error processing Twitter API response:', error);
          responseError = 'Failed to process server response';
          data = { error: responseError };
        }
        
        // Check if the response was successful
        if (response?.ok && (!responseError || data?.success)) {
          // Process results - handle either standard result format or create default results
          if (data?.results && Array.isArray(data.results)) {
            twitterResults = data.results;
          } else {
            // Create success results for each account
            twitterResults = selectedTwitterAccounts.map(account => ({
              username: account.username || account.userId, 
              success: true, 
              message: data?.message || 'Posted successfully'
            }));
          }
        } else {
          // Special case: if we get a 502 Bad Gateway error but the API actually processed the request
          if (response?.status === 502 && (
            data?.message?.includes('posted successfully') || 
            data?.message?.includes('success')
          )) {
            console.log('Detected successful post despite 502 response. Treating as success.');
            
            twitterResults = selectedTwitterAccounts.map(account => ({
              username: account.username || account.userId, 
              success: true, 
              message: 'Post likely succeeded but returned ambiguous response'
            }));
          } else {
            console.error('Twitter API error response:', {
              status: response?.status,
              statusText: response?.statusText,
              data: data,
              error: responseError
            });
            
            // Handle specific error codes for better user feedback
            if (response?.status === 400 && data?.error?.includes('validate')) {
              throw new Error('Invalid post data: Please check your caption and try again');
            } else if (response?.status === 401) {
              throw new Error('Authentication failed: Please reconnect your Twitter account');
            } else if (response?.status === 413) {
              throw new Error('Video file is too large: Try compressing the video or reducing its duration');
            } else if (response?.status === 429) {
              throw new Error('Too many requests: Please wait a few minutes and try again');
            } else if (response?.status === 502 || response?.status === 504) {
              throw new Error('Server gateway timeout: The video may be too large or the server is busy, please try again');
            } else {
              throw new Error(data?.error || responseError || 'Failed to post to Twitter');
            }
          }
        }
      } catch (error) {
        console.error('Error posting to Twitter:', error);
        console.error('Error details:', {
          message: error?.message || 'Unknown error',
          name: error?.name,
          isNetworkError: error?.name === 'AbortError' || error?.name === 'TypeError',
          stack: error?.stack
        });
        
        // Generate detailed error messages for each account
        twitterResults = selectedTwitterAccounts.map(account => ({
          username: account.username || account.userId, 
          success: false, 
          error: error?.message || 'Unknown error'
        }));
        
        // Still throw the error to be handled by the main component
        throw error;
      }
    }
    
    return { results: twitterResults };
  },
  
  // Load Twitter accounts from localStorage
  getAccounts: () => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (!socialMediaDataStr) {
        return [];
      }
      
      const socialMediaData = JSON.parse(socialMediaDataStr);
      if (!socialMediaData?.twitter || !Array.isArray(socialMediaData.twitter)) {
        return [];
      }
      
      return socialMediaData.twitter.filter(account => 
        account && account.userId
      );
    } catch (error) {
      console.error('Error getting Twitter accounts from socialMediaData:', error);
      return [];
    }
  }
};

export default TwitterPoster; 