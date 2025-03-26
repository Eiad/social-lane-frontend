import React from 'react';

const API_BASE_URL = 'https://sociallane-backend.mindio.chat';

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
    console.log(`Posting to ${selectedTwitterAccounts.length} Twitter accounts...`);
    
    try {
      let twitterResults = [];
      
      if (isScheduled) {
        // Handle scheduled Twitter posts
        console.log('Scheduling Twitter post for', scheduledAt.toISOString());
        const scheduleResponse = await fetch(`${API_BASE_URL}/schedules`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: firebaseUid,
            video_url: videoUrl,
            post_description: caption,
            platforms: ['twitter'],
            twitter_accounts: selectedTwitterAccounts.map(account => ({
              userId: account.userId,
              username: account.username
            })),
            isScheduled: true,
            scheduledDate: scheduledAt.toISOString()
          }),
        });
        
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
              console.error('Non-JSON response from schedule API:', text.substring(0, 500));
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
          throw new Error(scheduleData?.error || scheduleError || 'Failed to schedule Twitter post');
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
        
        try {
          const response = await fetch(`${API_BASE_URL}/social/twitter/post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(twitterPayload),
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
                responseError = `Invalid response from server (${response?.status || 'unknown status'})`;
                data = { error: responseError };
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
          
          if (response?.ok && !responseError) {
            if (data?.results && Array.isArray(data.results)) {
              twitterResults = data.results;
            } else {
              twitterResults = selectedTwitterAccounts.map(account => ({
                username: account.username || account.userId, 
                success: true, 
                message: data?.message || 'Posted successfully'
              }));
            }
          } else {
            throw new Error(data?.error || responseError || 'Failed to post to Twitter');
          }
        } catch (error) {
          console.error('Error posting to Twitter API:', error);
          throw error;
        }
      }
      
      return { success: true, results: twitterResults };
    } catch (error) {
      console.error('Error posting to Twitter:', error);
      const errorResults = selectedTwitterAccounts.map(account => ({
        username: account.username || account.userId, 
        success: false, 
        error: error?.message || 'Unknown error'
      }));
      
      return { success: false, results: errorResults, error: error?.message };
    }
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