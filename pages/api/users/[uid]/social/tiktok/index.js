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
          index: account?.index || 0,
          userInfo: account?.userInfo || null
        }))
        .filter(account => account.accessToken && account.openId);
      
      if (validatedAccounts.length === 0) {
        console.log('[USER TIKTOK] Error: No valid accounts after validation (missing required fields)');
        return res.status(400).json({ error: 'No valid TikTok accounts provided. Each account must have accessToken and openId.' });
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
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
      const backendEndpoint = `${apiBaseUrl}/users/${uid}/social/tiktok`;
      
      console.log(`[USER TIKTOK] Using backend endpoint: ${backendEndpoint}`);
      
      const response = await axios.post(backendEndpoint, validatedAccounts, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[USER TIKTOK] Backend response status:', response.status);
      
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER TIKTOK] Error saving TikTok accounts:', error?.response?.data || error.message);
      
      return res.status(error?.response?.status || 500).json({
        error: 'Error saving TikTok accounts to user profile',
        details: error?.response?.data || error.message
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
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
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