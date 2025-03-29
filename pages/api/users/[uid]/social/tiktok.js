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
      
      // Ensure all accounts have the required fields
      const validatedAccounts = accountsArray
        .map(account => ({
          accessToken: account?.accessToken || '',
          openId: account?.openId || '',
          refreshToken: account?.refreshToken || '',
          username: account?.username || account?.userInfo?.username || `TikTok Account ${account?.index || 0}`,
          displayName: account?.displayName || account?.userInfo?.display_name || '',
          avatarUrl: account?.avatarUrl || account?.userInfo?.avatar_url || '',
          avatarUrl100: account?.avatarUrl100 || account?.userInfo?.avatar_url_100 || '',
          index: account?.index || 0
        }))
        .filter(account => account.accessToken && account.openId); // Filter out invalid accounts
      
      if (validatedAccounts.length === 0) {
        console.log('[USER TIKTOK] Error: No valid accounts after validation (missing required fields)');
        return res.status(400).json({ error: 'No valid TikTok accounts provided. Each account must have accessToken and openId.' });
      }

      // Forward the request to the backend
      const backendUrl = process.env.NEXT_PUBLIC_API_URL;
      const apiUrl = `${backendUrl}/users/${uid}/social/tiktok`;
      
      console.log('[USER TIKTOK] Forwarding request to backend:', apiUrl);
      console.log('[USER TIKTOK] Sending accounts data:', JSON.stringify(validatedAccounts.map(a => ({
        openId: a.openId,
        hasAccessToken: !!a.accessToken,
        hasRefreshToken: !!a.refreshToken,
        username: a.username,
        index: a.index
      }))));
      
      const response = await axios({
        method: 'post',
        url: apiUrl,
        data: validatedAccounts,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 seconds timeout
      });
      
      console.log('[USER TIKTOK] Backend response status:', response.status);
      console.log('[USER TIKTOK] Backend response success:', response?.data?.success);
      
      // Return the response from the backend
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER TIKTOK] Error saving accounts:', error?.message);
      
      if (error.response) {
        console.error('[USER TIKTOK] Backend error response:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      // Return appropriate error response
      const status = error.response?.status || 500;
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      
      return res.status(status).json({ 
        error: 'Error saving TikTok accounts', 
        details: errorMessage 
      });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { uid } = req.query;
      const { openId } = req.query;
      
      if (!uid) {
        console.log('[USER TIKTOK] Error: Missing user ID in DELETE request');
        return res.status(400).json({ error: 'Missing user ID' });
      }
      
      if (!openId) {
        console.log('[USER TIKTOK] Error: Missing TikTok openId in DELETE request');
        return res.status(400).json({ error: 'Missing TikTok openId' });
      }
      
      // Forward the delete request to the backend
      const backendUrl = process.env.NEXT_PUBLIC_API_URL;
      const apiUrl = `${backendUrl}/users/${uid}/social/tiktok?openId=${openId}`;
      
      console.log('[USER TIKTOK] Forwarding DELETE request to backend:', apiUrl);
      
      const response = await axios({
        method: 'delete',
        url: apiUrl,
        timeout: 15000 // 15 seconds timeout
      });
      
      console.log('[USER TIKTOK] Backend DELETE response status:', response.status);
      console.log('[USER TIKTOK] Backend DELETE response success:', response?.data?.success);
      
      // Return the response from the backend
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER TIKTOK] Error deleting account:', error?.message);
      
      if (error.response) {
        console.error('[USER TIKTOK] Backend delete error response:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      // Return appropriate error response
      const status = error.response?.status || 500;
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      
      return res.status(status).json({ 
        error: 'Error deleting TikTok account', 
        details: errorMessage 
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 