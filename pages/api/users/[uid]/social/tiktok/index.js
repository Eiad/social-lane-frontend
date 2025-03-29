import axios from 'axios';

export default async function handler(req, res) {
  console.log('[USER TIKTOK] Request received:', req.method);
  
  if (req.method === 'POST') {
    try {
      const { uid } = req.query;
      
      if (!uid) {
        console.log('[USER TIKTOK] Error: Missing user ID');
        return res.status(400).json({ error: 'Missing user ID' });
      }

      const accountsData = req.body;
      
      console.log('[USER TIKTOK] Received accounts data:', {
        dataType: typeof accountsData,
        isArray: Array.isArray(accountsData),
        length: Array.isArray(accountsData) ? accountsData.length : 'not an array'
      });
      
      if (!accountsData || (Array.isArray(accountsData) && accountsData.length === 0)) {
        console.log('[USER TIKTOK] Error: Invalid or empty accounts data');
        return res.status(400).json({ error: 'Invalid or empty accounts data' });
      }
      
      // Convert to array if not already (handle single account case)
      const accountsArray = Array.isArray(accountsData) ? accountsData : [accountsData];
      
      // Validate that each account has the required fields
      const validatedAccounts = accountsArray.map(account => {
        if (!account?.openId) {
          console.log('[USER TIKTOK] Warning: Account missing openId, skipping validation');
          return account;
        }
        
        // Ensure we have the OpenID even if sent as accountId instead
        const openId = account.openId || account.accountId || '';
        
        return {
          accessToken: account?.accessToken || '',
          openId: openId,
          refreshToken: account?.refreshToken || '',
          username: account?.username || account?.userInfo?.username || `TikTok Account`,
          displayName: account?.displayName || account?.userInfo?.display_name || '',
          avatarUrl: account?.avatarUrl || account?.userInfo?.avatar_url || '',
          avatarUrl100: account?.avatarUrl100 || account?.userInfo?.avatarUrl100 || account?.userInfo?.avatar_url_100 || '',
          userInfo: account?.userInfo || {}
        };
      }).filter(account => account.openId);
      
      if (validatedAccounts.length === 0) {
        console.log('[USER TIKTOK] Error: No valid accounts after validation (missing required fields)');
        return res.status(400).json({ error: 'No valid TikTok accounts provided. Each account must have openId.' });
      }
      
      console.log('[USER TIKTOK] Account user info available:', validatedAccounts.map(a => ({
        accountId: a.openId,
        hasUsername: !!a.username,
        hasDisplayName: !!a.displayName,
        hasAvatarUrl: !!a.avatarUrl,
        hasAvatarUrl100: !!a.avatarUrl100
      })));
      
      console.log(`[USER TIKTOK] Sending ${validatedAccounts.length} validated accounts to backend`);
      
      // Get backend URL from environment or use default
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const backendEndpoint = `${apiBaseUrl}/users/${uid}/social/tiktok`;
      
      console.log(`[USER TIKTOK] Using backend endpoint: ${backendEndpoint}`);
      
      // Implement retry logic
      let backendResponse;
      let lastError;
      const MAX_RETRIES = 3;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[USER TIKTOK] Backend request attempt ${attempt}/${MAX_RETRIES}`);
          
          backendResponse = await axios.post(backendEndpoint, validatedAccounts, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 * attempt // Increase timeout with each retry
          });
          
          // If successful, break out of retry loop
          break;
        } catch (error) {
          lastError = error;
          console.error(`[USER TIKTOK] Backend request attempt ${attempt} failed:`, error?.message || error);
          
          // If we've exhausted all retries, rethrow the error
          if (attempt === MAX_RETRIES) {
            throw error;
          }
          
          // Otherwise, wait with exponential backoff before retrying
          const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s, etc.
          console.log(`[USER TIKTOK] Retrying backend request in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      console.log('[USER TIKTOK] Backend response status:', backendResponse.status);
      
      // Return success response with more details
      return res.status(backendResponse.status).json({
        success: true,
        message: 'TikTok accounts saved successfully',
        accounts: validatedAccounts.map(acc => ({
          accountId: acc.openId,
          username: acc.username,
          displayName: acc.displayName
        })),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[USER TIKTOK] Error saving TikTok accounts:', error?.response?.data || error.message);
      
      // Add more detailed error info for debugging
      let errorDetails = {
        message: error?.message || 'Unknown error',
        time: new Date().toISOString()
      };
      
      if (error.response) {
        errorDetails.status = error.response.status;
        errorDetails.data = error.response.data;
      } else if (error.request) {
        errorDetails.request = {
          method: error.request.method,
          url: error.request.path
        };
      }
      
      console.error('[USER TIKTOK] Detailed error:', errorDetails);
      
      return res.status(error?.response?.status || 500).json({
        error: 'Error saving TikTok accounts to user profile',
        details: error?.response?.data || error.message,
        errorInfo: errorDetails
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { uid } = req.query;
      const { openId } = req.query;
      
      if (!uid) {
        return res.status(400).json({ error: 'Missing user ID' });
      }
      
      if (!openId) {
        return res.status(400).json({ error: 'Missing TikTok account ID (openId)' });
      }
      
      console.log(`[USER TIKTOK] Deleting TikTok account ${openId} for user ${uid}`);
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const backendEndpoint = `${apiBaseUrl}/users/${uid}/social/tiktok?openId=${openId}`;
      
      const response = await axios.delete(backendEndpoint);
      
      console.log('[USER TIKTOK] Delete response status:', response.status);
      
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER TIKTOK] Error deleting TikTok account:', error?.response?.data || error.message);
      
      return res.status(error?.response?.status || 500).json({
        error: 'Error deleting TikTok account',
        details: error?.response?.data || error.message
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 