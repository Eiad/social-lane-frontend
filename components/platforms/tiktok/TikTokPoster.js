import React from 'react';

const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

const TikTokPoster = {
  // Post to TikTok - handles both immediate and scheduled posts
  postToTikTok: async ({
    selectedTiktokAccounts,
    videoUrl,
    caption,
    firebaseUid,
    isScheduled,
    scheduledAt,
  }) => {
    console.log(`Posting to ${selectedTiktokAccounts.length} TikTok accounts...`);
    
    const API_BASE_URL = '/api';
    let tiktokResults = [];
    
    // Enhanced fetch with timeout and retry
    const fetchWithTimeoutAndRetry = async (url, options, timeout = 300000, maxRetries = 3) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          console.log(`TikTok API attempt ${attempt}/${maxRetries}`);
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          lastError = error;
          console.error(`TikTok API attempt ${attempt} failed:`, error?.message || error);
          
          if (attempt < maxRetries) {
            const delay = 2000 * Math.pow(2, attempt - 1);
            console.log(`Retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw lastError || new Error('All retry attempts failed');
    };
    
    if (isScheduled && scheduledAt) {
      // Handle scheduled posts
      console.log('Scheduling TikTok post for', scheduledAt);
      
      try {
        // Use the enhanced fetch with timeout and retry for scheduling
        const scheduleResponse = await fetchWithTimeoutAndRetry(
          `${API_BASE_URL}/schedules`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Timestamp': Date.now(), // Add timestamp to prevent caching
            },
            body: JSON.stringify({
              userId: firebaseUid,
              video_url: videoUrl,
              post_description: caption,
              platforms: ['tiktok'],
              tiktok_accounts: selectedTiktokAccounts.map(account => ({
                accountId: account.accountId || account.openId,
                username: account.username || '',
                displayName: account.displayName || ''
              })),
              isScheduled: true,
              scheduledDate: scheduledAt.toISOString()
            }),
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
              console.error('Error parsing JSON from schedule API:', jsonError);
              scheduleError = 'Invalid JSON in schedule server response';
              scheduleData = { error: scheduleError };
            }
          } else {
            // Handle non-JSON responses (like HTML error pages)
            try {
              const text = await scheduleResponse.text();
              console.error('Non-JSON response from TikTok schedule API:', text.substring(0, 500));
              scheduleError = `Invalid response from schedule server (${scheduleResponse?.status || 'unknown status'})`;
              scheduleData = { error: scheduleError };
            } catch (textError) {
              console.error('Error reading schedule response text:', textError);
              scheduleError = 'Failed to read schedule server response';
              scheduleData = { error: scheduleError };
            }
          }
        } catch (error) {
          console.error('Error processing schedule API response:', error);
          scheduleError = 'Failed to process schedule server response';
          scheduleData = { error: scheduleError };
        }
        
        if (scheduleResponse?.ok && !scheduleError) {
          tiktokResults = selectedTiktokAccounts.map(account => ({
            displayName: account?.displayName || account?.userInfo?.display_name || account?.username || '',
            username: account?.username || '', 
            success: true, 
            message: 'Post scheduled successfully'
          }));
        } else {
          // Handle specific error codes for better user feedback
          if (scheduleResponse?.status === 400 && scheduleData?.error?.includes('validate')) {
            throw new Error('Invalid scheduling data: Please check your caption and try again');
          } else if (scheduleResponse?.status === 401) {
            throw new Error('Authentication failed: Please reconnect your TikTok account');
          } else if (scheduleResponse?.status === 413) {
            throw new Error('Video file is too large: Try compressing the video or reducing its duration');
          } else if (scheduleResponse?.status === 429) {
            throw new Error('Too many requests: Please wait a few minutes and try again');
          } else if (scheduleResponse?.status === 502 || scheduleResponse?.status === 504) {
            throw new Error('Server gateway timeout: The video may be too large or the server is busy, please try again');
          } else {
            throw new Error(scheduleData?.error || scheduleError || 'Failed to schedule TikTok post');
          }
        }
      } catch (error) {
        console.error('Error scheduling TikTok post:', error);
        
        // Generate detailed error messages for each account
        tiktokResults = selectedTiktokAccounts.map(account => ({
          displayName: account?.displayName || account?.userInfo?.display_name || account?.username || '',
          username: account?.username || '', 
          success: false, 
          error: error?.message || 'Failed to schedule post'
        }));
        
        // Still throw the error to be handled by the main component
        throw error;
      }
    } else {
      // Handle immediate posts to multiple TikTok accounts
      console.log('Sending immediate TikTok post for multiple accounts');
      
      // Create TikTok payload
      const tiktokPayload = {
        userId: firebaseUid,
        videoUrl: videoUrl,
        caption: caption,
        accounts: selectedTiktokAccounts.map(account => ({
          accountId: account.accountId || account.openId,
          username: account.username || '',
          displayName: account.displayName || ''
        }))
      };
      
      try {
        // Use enhanced fetch with longer timeout and retry logic
        const response = await fetchWithTimeoutAndRetry(
          `${API_BASE_URL}/tiktok/post-multi`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Timestamp': Date.now(), // Add timestamp to prevent caching
            },
            body: JSON.stringify(tiktokPayload),
          },
          300000, // 5 minute timeout for multiple TikTok posts
          3       // 3 retry attempts
        );
        
        let data;
        let responseError = null;
        
        try {
          // First check if the response is valid
          const contentType = response?.headers?.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              data = await response.json();
            } catch (jsonError) {
              console.error('Error parsing JSON from TikTok API:', jsonError);
              responseError = 'Invalid JSON in server response';
              data = { error: responseError };
            }
          } else {
            // Handle non-JSON responses (like HTML error pages)
            try {
              const text = await response.text();
              console.error('Non-JSON response from TikTok API:', text.substring(0, 500));
              
              // If the response contains certain TikTok-specific success indicators, consider it a success
              if (text.includes('PUBLISH_COMPLETE') || text.includes('success') || text.includes('posted successfully')) {
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
          console.error('Error processing TikTok API response:', error);
          responseError = 'Failed to process server response';
          data = { error: responseError };
        }
        
        // Check if the response was successful
        if (response?.ok && (!responseError || data?.success)) {
          // Process results - handle either standard result format or create default results
          if (data?.results && Array.isArray(data.results)) {
            tiktokResults = data.results;
          } else {
            // Create success results for each account
            tiktokResults = selectedTiktokAccounts.map(account => ({
              displayName: account?.displayName || account?.userInfo?.display_name || account?.username || '',
              username: account?.username || '', 
              success: true, 
              message: data?.message || 'Posted successfully'
            }));
          }
        } else {
          // Special case: if we get a 502 Bad Gateway error but the API actually processed the request
          if (response?.status === 502 && (
            data?.message?.includes('posted successfully') || 
            data?.message?.includes('PUBLISH_COMPLETE')
          )) {
            console.log('Detected successful post despite 502 response. Treating as success.');
            
            tiktokResults = selectedTiktokAccounts.map(account => ({
              displayName: account?.displayName || account?.userInfo?.display_name || account?.username || '',
              username: account?.username || '', 
              success: true, 
              message: 'Post likely succeeded but returned ambiguous response'
            }));
          } else {
            // Handle specific error codes for better user feedback
            if (response?.status === 400 && data?.error?.includes('validate')) {
              throw new Error('Invalid post data: Please check your caption and try again');
            } else if (response?.status === 401) {
              throw new Error('Authentication failed: Please reconnect your TikTok account');
            } else if (response?.status === 413) {
              throw new Error('Video file is too large: Try compressing the video or reducing its duration');
            } else if (response?.status === 429) {
              throw new Error('Too many requests: Please wait a few minutes and try again');
            } else if (response?.status === 502 || response?.status === 504) {
              throw new Error('Server gateway timeout: The video may be too large or the server is busy, please try again');
            } else {
              throw new Error(data?.error || responseError || 'Failed to post to TikTok');
            }
          }
        }
      } catch (error) {
        console.error('Error posting to TikTok:', error);
        
        // Generate detailed error messages for each account
        tiktokResults = selectedTiktokAccounts.map(account => ({
          displayName: account?.displayName || account?.userInfo?.display_name || account?.username || '',
          username: account?.username || '', 
          success: false, 
          error: error?.message || 'Unknown error'
        }));
        
        // Still throw the error to be handled by the main component
        throw error;
      }
    }
    
    return { results: tiktokResults };
  },
  
  // Load TikTok accounts from localStorage
  getAccounts: () => {
    try {
      const socialMediaDataStr = localStorage?.getItem('socialMediaData');
      if (!socialMediaDataStr) {
        return [];
      }
      
      const socialMediaData = JSON.parse(socialMediaDataStr);
      if (!socialMediaData?.tiktok || !Array.isArray(socialMediaData.tiktok)) {
        return [];
      }
      
      // Updated to work with the new data structure that only stores display info
      return socialMediaData.tiktok.filter(account => 
        account && account.accountId
      );
    } catch (error) {
      console.error('Error getting TikTok accounts from socialMediaData:', error);
      return [];
    }
  }
};

export default TikTokPoster; 