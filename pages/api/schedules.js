// API endpoint to handle schedule creation
// This forwards requests to the backend schedules endpoint

export default async function handler(req, res) {
  console.log('[SCHEDULES API] Request received:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      userId, 
      video_url, 
      post_description, 
      platforms, 
      tiktok_accounts, 
      twitter_accounts,
      isScheduled,
      scheduledDate
    } = req.body;
    
    console.log('[SCHEDULES API] Received scheduling request:', {
      userId,
      hasVideoUrl: !!video_url,
      hasPlatforms: !!platforms,
      platformsCount: platforms?.length,
      hasTikTokAccounts: !!tiktok_accounts,
      tikTokAccountsCount: tiktok_accounts?.length,
      hasTwitterAccounts: !!twitter_accounts,
      twitterAccountsCount: twitter_accounts?.length,
      isScheduled,
      scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null
    });
    
    // Validate required fields
    if (!userId) {
      console.error('[SCHEDULES API] Missing user ID');
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    if (!video_url) {
      console.error('[SCHEDULES API] Missing video URL');
      return res.status(400).json({ error: 'Missing video URL' });
    }
    
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      console.error('[SCHEDULES API] Missing platforms');
      return res.status(400).json({ error: 'At least one platform must be selected' });
    }
    
    if (platforms.includes('tiktok') && (!tiktok_accounts || !Array.isArray(tiktok_accounts) || tiktok_accounts.length === 0)) {
      console.error('[SCHEDULES API] Missing TikTok accounts');
      return res.status(400).json({ error: 'At least one TikTok account must be selected' });
    }
    
    if (platforms.includes('twitter') && (!twitter_accounts || !Array.isArray(twitter_accounts) || twitter_accounts.length === 0)) {
      console.error('[SCHEDULES API] Missing Twitter accounts');
      return res.status(400).json({ error: 'At least one Twitter account must be selected' });
    }
    
    if (isScheduled && !scheduledDate) {
      console.error('[SCHEDULES API] Missing scheduled date');
      return res.status(400).json({ error: 'Scheduled date is required for scheduled posts' });
    }
    
    // Create a modified request body
    const modifiedRequestBody = { ...req.body };
    
    // Fix Twitter accounts to include required token fields
    // The backend will look up the actual tokens from the database using userId
    if (platforms?.includes('twitter') && twitter_accounts?.length > 0) {
      console.log('[SCHEDULES API] Modifying Twitter accounts to add required token fields');
      
      modifiedRequestBody.twitter_accounts = twitter_accounts.map(account => ({
        ...account,
        // Add placeholder tokens that will be replaced by the backend with real tokens from DB
        accessToken: account.accessToken || 'placeholder_to_be_replaced_from_db',
        accessTokenSecret: account.accessTokenSecret || 'placeholder_to_be_replaced_from_db'
      }));
      
      console.log('[SCHEDULES API] Modified Twitter accounts:', 
        modifiedRequestBody.twitter_accounts.map(acc => ({
          userId: acc.userId,
          username: acc.username,
          hasAccessToken: !!acc.accessToken,
          hasAccessTokenSecret: !!acc.accessTokenSecret
        }))
      );
    }
    
    // Forward the request to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
    const apiUrl = `${backendUrl}/posts`;
    
    console.log('[SCHEDULES API] Forwarding request to backend posts endpoint:', apiUrl);
    
    // Enhanced fetch with timeout handling and retry
    const maxRetries = 3;
    const timeout = 180000; // 3 minutes timeout
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        console.log(`[SCHEDULES API] Attempt ${attempt}/${maxRetries}`);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Timestamp': Date.now(), // Add timestamp to prevent caching
          },
          body: JSON.stringify(modifiedRequestBody), // Use the modified request body
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Ensure we have a proper JSON response
        let responseData;
        try {
          const contentType = response.headers.get("content-type");
          
          if (contentType && contentType.includes("application/json")) {
            responseData = await response.json();
          } else {
            // For non-JSON responses, like HTML error pages
            const text = await response.text();
            console.error('[SCHEDULES API] Non-JSON response from backend:', text.substring(0, 500));
            
            // If this is the last attempt, throw an error
            if (attempt === maxRetries) {
              throw new Error(`Invalid response format from server (${response.status})`);
            }
            
            // Otherwise, continue to the next retry
            throw new Error('Non-JSON response, will retry');
          }
        } catch (jsonError) {
          // If parsing JSON fails but the response was successful, create a default success response
          if (response.ok) {
            console.warn('[SCHEDULES API] JSON parsing failed but response was OK, creating default success response');
            responseData = { success: true, message: 'Post scheduled successfully' };
          } else {
            // If this is the last attempt, throw the JSON error
            if (attempt === maxRetries) {
              throw jsonError;
            }
            
            // Otherwise, continue to the next retry
            console.error('[SCHEDULES API] JSON parsing error:', jsonError.message);
            throw new Error('JSON parsing error, will retry');
          }
        }
        
        console.log('[SCHEDULES API] Backend response status:', response.status);
        console.log('[SCHEDULES API] Backend response success:', responseData?.success);
        
        return res.status(response.status).json(responseData);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        lastError = fetchError;
        
        if (fetchError.name === 'AbortError') {
          console.error(`[SCHEDULES API] Request timed out on attempt ${attempt}`);
          
          // If this is the last attempt, return a timeout error
          if (attempt === maxRetries) {
            return res.status(504).json({ 
              error: 'Request to backend timed out after multiple attempts', 
              details: 'The server took too long to respond, possibly due to video processing. Your post may still be scheduled, please check your scheduled posts list.'
            });
          }
        } else {
          console.error(`[SCHEDULES API] Error on attempt ${attempt}:`, fetchError.message);
        }
        
        // If we have more retries left, wait and continue
        if (attempt < maxRetries) {
          const delay = 2000 * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[SCHEDULES API] Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we got here, all retries failed
    throw lastError || new Error('All retry attempts failed');
  } catch (error) {
    console.error('[SCHEDULES API] Error processing request:', error.message);
    
    return res.status(500).json({ 
      error: 'Error processing scheduling request', 
      details: error.message,
      message: 'There was a problem scheduling your post. Your video may be too large or the server is experiencing high load. Please try again later or reduce your video file size.'
    });
  }
} 