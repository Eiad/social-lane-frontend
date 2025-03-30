// Next.js API route for Twitter posting
// This acts as a proxy to avoid CORS issues with direct browser-to-backend requests

export default async function handler(req, res) {
  console.log('[TWITTER POST] Post to Twitter accounts request received');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoUrl, text, userId, accounts } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Missing video URL' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: 'Must provide at least one account' });
    }

    // Prepare the data to send to backend
    const postData = {
      videoUrl,
      text,
      userId,
      accounts: accounts.map(account => ({
        userId: account.userId,
        username: account.username || ''
      }))
    };
    
    console.log(`[TWITTER POST] Posting to ${accounts.length} Twitter accounts for user ${userId.substring(0, 8)}...`);

    // Forward the request to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${backendUrl}/social/twitter/post`;
    
    console.log('[TWITTER POST] Forwarding request to backend:', apiUrl);
    
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
        console.log('[TWITTER POST] Backend returned success with data:', {
          message: data.message || 'Tweets posted successfully',
          accounts: data.results?.length || 'unknown'
        });
        
        return res.status(200).json({
          success: true,
          message: data.message || 'Tweets posted successfully',
          ...data
        });
      } else {
        // Handle non-JSON success response
        const text = await response.text();
        console.log('[TWITTER POST] Backend returned non-JSON success response');
        
        // Create simulated successful results
        const results = accounts.map(account => ({
          userId: account.userId,
          username: account.username || '',
          success: true,
          message: 'Tweet likely processed successfully'
        }));
        
        return res.status(200).json({
          success: true,
          message: 'Tweets likely posted successfully, but response was not in JSON format',
          results,
          rawResponse: text.substring(0, 100) + '...' // Only include beginning of response
        });
      }
    } else {
      // Error handling
      let errorData;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json();
        } else {
          const text = await response.text();
          errorData = { error: `Server error: ${response.status}`, details: text.substring(0, 200) + '...' };
        }
      } catch (parseError) {
        errorData = { error: `Error parsing response: ${parseError.message}` };
      }
      
      console.log('[TWITTER POST] Backend returned error:', {
        status: response.status,
        error: errorData.error || 'Unknown error'
      });
      
      // Special handling for timeout errors
      if (response.status === 524 || response.status === 504) {
        console.log('[TWITTER POST] Detected timeout error. The posts may have still gone through.');
        
        // For timeouts, we create a more nuanced response since some posts might have succeeded
        return res.status(202).json({
          success: true, // Consider it potentially successful since timeouts often happen after processing
          partial: true, // Flag to indicate uncertain/partial success
          message: 'The request timed out, but some posts may have completed successfully. Check your Twitter accounts.',
          results: accounts.map(account => ({
            userId: account.userId,
            username: account.username || '',
            success: true, // Optimistically assume success
            pending: true, // Flag to indicate uncertain status
            message: 'Twitter posting request timed out. The tweet may have posted successfully. Please check your Twitter account.'
          }))
        });
      }
      
      // Create results for each account
      const results = accounts.map(account => ({
        userId: account.userId,
        username: account.username || '',
        success: false,
        error: errorData.error || `Server returned ${response.status}`
      }));
      
      return res.status(response.status).json({
        success: false,
        error: errorData.error || `Server returned ${response.status}`,
        details: errorData.details || errorData.message || 'No additional details',
        results
      });
    }
  } catch (error) {
    console.error('[TWITTER POST] Error posting to Twitter accounts:', error);
    
    // Special handling for timeout errors
    if (error.name === 'AbortError') {
      const { accounts } = req.body;
      
      console.log('[TWITTER POST] Request aborted/timed out. Some posts may have completed successfully.');
      
      return res.status(202).json({
        success: true, // Consider it potentially successful
        partial: true, // Flag to indicate uncertain/partial success
        error: 'The request timed out. The tweets may still be processing.',
        message: 'The request timed out, but some posts may have completed successfully. Check your Twitter accounts.',
        results: accounts.map(account => ({
          userId: account.userId,
          username: account.username || '',
          success: true, // Optimistically assume success
          pending: true, // Flag to indicate uncertain status
          message: 'Twitter posting request timed out. The tweet may have posted successfully. Please check your Twitter account.'
        }))
      });
    }
    
    const { accounts } = req.body || { accounts: [] };
    const results = Array.isArray(accounts) ? accounts.map(account => ({
      userId: account.userId,
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