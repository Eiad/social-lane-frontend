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
    
    try {
      // Create TikTok payload
      const tiktokPayload = {
        userId: firebaseUid,
        videoUrl: videoUrl,
        caption: caption,
        accounts: selectedTiktokAccounts.map(account => ({
          accessToken: account.accessToken,
          openId: account.openId,
          refreshToken: account.refreshToken || '',
          username: account.username || '',
          displayName: account.displayName || account.userInfo?.display_name || account.username || ''
        })),
        scheduled: isScheduled,
        scheduledAt: isScheduled ? scheduledAt.toISOString() : null
      };
      
      console.log('TikTok payload:', {
        videoUrl: tiktokPayload.videoUrl,
        caption: tiktokPayload.caption,
        accounts: `${tiktokPayload.accounts.length} accounts`
      });
      
      let tiktokResults = [];
      
      if (isScheduled) {
        // Handle scheduled posts
        console.log('Scheduling TikTok post for', tiktokPayload.scheduledAt);
        const scheduleResponse = await fetch(`${API_BASE_URL}/schedules`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: firebaseUid,
            video_url: tiktokPayload.videoUrl,
            post_description: tiktokPayload.caption,
            platforms: ['tiktok'],
            tiktok_accounts: tiktokPayload.accounts,
            isScheduled: true,
            scheduledDate: tiktokPayload.scheduledAt
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
          throw new Error(scheduleData?.error || scheduleError || 'Failed to schedule TikTok post');
        }
      } else {
        // Handle immediate posts
        console.log('Sending immediate TikTok post with payload:', {
          videoUrl: tiktokPayload.videoUrl,
          caption: tiktokPayload.caption,
          accountsCount: tiktokPayload.accounts.length,
          firstAccount: tiktokPayload.accounts[0] ? {
            hasAccessToken: !!tiktokPayload.accounts[0].accessToken,
            hasOpenId: !!tiktokPayload.accounts[0].openId
          } : 'no accounts'
        });
        
        const response = await fetch(`${API_BASE_URL}/social/tiktok/post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tiktokPayload),
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
              console.error('Error parsing JSON from TikTok API:', jsonError);
              responseError = 'Invalid JSON in server response';
              data = { error: responseError };
            }
          } else {
            // Handle non-JSON responses (like HTML error pages)
            try {
              const text = await response.text();
              console.error('Non-JSON response from TikTok API:', text.substring(0, 500));
              responseError = `Invalid response from server (${response?.status || 'unknown status'})`;
              data = { error: responseError };
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
        
        if (response?.ok && !responseError) {
          if (data?.results && Array.isArray(data.results)) {
            tiktokResults = data.results;
          } else {
            tiktokResults = selectedTiktokAccounts.map(account => ({
              displayName: account?.displayName || account?.userInfo?.display_name || account?.username || '',
              username: account?.username || '', 
              success: true, 
              message: data?.message || 'Posted successfully'
            }));
          }
        } else {
          throw new Error(data?.error || responseError || 'Failed to post to TikTok');
        }
      }
      
      return { success: true, results: tiktokResults };
    } catch (error) {
      console.error('Error posting to TikTok:', error);
      const errorResults = selectedTiktokAccounts.map(account => ({
        displayName: account?.displayName || account?.userInfo?.display_name || account?.username || '',
        username: account?.username || '', 
        success: false, 
        error: error?.message || 'Unknown error'
      }));
      
      return { success: false, results: errorResults, error: error?.message };
    }
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
      
      return socialMediaData.tiktok.filter(account => 
        account && account.accessToken && account.openId
      );
    } catch (error) {
      console.error('Error getting TikTok accounts from socialMediaData:', error);
      return [];
    }
  }
};

export default TikTokPoster; 