// No need to import fetch, it's available globally in Next.js API routes
// import fetch from 'node-fetch';

export default async function handler(req, res) {
  console.log('[TIKTOK MULTI IMAGES] Post images to multiple TikTok accounts request received');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrls, caption, userId, accounts } = req.body;
    
    if (!imageUrls || (Array.isArray(imageUrls) && imageUrls.length === 0)) {
      return res.status(400).json({ error: 'Missing image URLs' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: 'Must provide at least one account' });
    }

    // Prepare the data to send to backend
    const postData = {
      imageUrls,
      caption,
      userId,
      accounts: accounts.map(account => ({
        accountId: account.accountId,
        displayName: account.displayName || '',
        username: account.username || ''
      }))
    };
    
    console.log(`[TIKTOK MULTI IMAGES] Posting to ${accounts.length} TikTok accounts for user ${userId}`);

    // Forward the request to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${backendUrl}/tiktok/post-images-multi`;
    
    console.log('[TIKTOK MULTI IMAGES] Forwarding request to backend:', apiUrl);
    
    // Function that wraps fetch with a timeout
    const fetchWithTimeout = async (url, options, timeout = 300000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    // Make request with longer timeout and better error handling
    const response = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      },
      300000 // 5 minute timeout for multi-account posting
    );

    // Process response differently based on status and content type
    if (response.ok) {
      // Check for JSON response
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        console.log('[TIKTOK MULTI IMAGES] Backend returned success with data:', {
          message: data.message || 'Images posted successfully',
          accounts: data.results?.length || 'unknown'
        });
        
        return res.status(200).json({
          success: true,
          message: data.message || 'Images posted successfully',
          ...data
        });
      } else {
        // Handle non-JSON success response
        const text = await response.text();
        console.log('[TIKTOK MULTI IMAGES] Backend returned non-JSON success response');
        
        // Create simulated successful results
        const results = accounts.map(account => ({
          accountId: account.accountId,
          displayName: account.displayName || '',
          username: account.username || '',
          success: true,
          message: 'Post likely processed successfully'
        }));
        
        return res.status(200).json({
          success: true,
          message: 'Images likely posted successfully, but response was not in JSON format',
          results,
          rawResponse: text.substring(0, 100) + '...' // Only include beginning of response
        });
      }
    } else {
      // Handle error response with detailed information
      let errorInfo = {};
      try {
        errorInfo = await response.json();
      } catch (e) {
        try {
          const errorText = await response.text();
          errorInfo = { error: errorText.substring(0, 500) };
        } catch (e2) {
          errorInfo = { error: `HTTP Status ${response.status}` };
        }
      }
      
      console.error('[TIKTOK MULTI IMAGES] Backend returned error:', {
        status: response.status,
        error: errorInfo?.error || 'Unknown error'
      });
      
      // Add account details to error for better client-side handling
      const results = accounts.map(account => ({
        accountId: account.accountId,
        displayName: account.displayName || '',
        username: account.username || '',
        success: false,
        error: errorInfo?.error || `Failed with status ${response.status}`
      }));
      
      return res.status(response.status).json({
        success: false,
        message: 'Failed to post images to TikTok accounts',
        error: errorInfo?.error || `Error ${response.status}`,
        results
      });
    }
  } catch (error) {
    console.error('[TIKTOK MULTI IMAGES] Error posting to multiple accounts:', error);
    
    // Special handling for timeout errors
    if (error.name === 'AbortError') {
      const { accounts } = req.body;
      
      console.log('[TIKTOK MULTI IMAGES] Request aborted/timed out. Some posts may have completed successfully.');
      
      return res.status(202).json({
        success: true, // Consider it potentially successful
        partial: true, // Flag to indicate uncertain status
        error: 'The request timed out. The images may still be processing on TikTok.',
        message: 'The request timed out, but some images may have completed successfully. Check your TikTok accounts.',
        results: accounts.map(account => ({
          accountId: account.accountId,
          displayName: account.displayName || '',
          username: account.username || '',
          success: true, // Optimistically assume success for UI
          pending: true, // Flag to indicate uncertain status
          message: 'TikTok posting request timed out. The images may have been posted successfully. Please check your TikTok account.'
        }))
      });
    }
    
    const { accounts } = req.body || { accounts: [] };
    const results = Array.isArray(accounts) ? accounts.map(account => ({
      accountId: account.accountId,
      displayName: account.displayName || '',
      username: account.username || '',
      success: false,
      error: error.message || 'Unknown error'
    })) : [];
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack ? error.stack.split('\n')[0] : 'No additional details',
      results
    });
  }
} 