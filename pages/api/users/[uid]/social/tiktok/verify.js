import axios from 'axios';

export default async function handler(req, res) {
  console.log('[USER TIKTOK VERIFY] Request received:', req.method);
  
  if (req.method === 'POST') {
    try {
      const { uid } = req.query;
      
      if (!uid) {
        console.log('[USER TIKTOK VERIFY] Error: Missing user ID');
        return res.status(400).json({ error: 'Missing user ID' });
      }

      const accountsData = req.body;
      
      console.log('[USER TIKTOK VERIFY] Received accounts to verify:', {
        dataType: typeof accountsData,
        isArray: Array.isArray(accountsData),
        length: Array.isArray(accountsData) ? accountsData.length : 'not an array'
      });
      
      if (!accountsData || (Array.isArray(accountsData) && accountsData.length === 0)) {
        console.log('[USER TIKTOK VERIFY] Error: No accounts to verify');
        return res.status(400).json({ error: 'No accounts to verify' });
      }
      
      // Convert to array if not already (handle single account case)
      const accountsArray = Array.isArray(accountsData) ? accountsData : [accountsData];
      
      // Extract account IDs to verify
      const accountIds = accountsArray.map(account => ({
        accountId: account?.accountId || account?.openId || ''
      })).filter(account => account.accountId);
      
      if (accountIds.length === 0) {
        console.log('[USER TIKTOK VERIFY] Error: No valid account IDs found');
        return res.status(400).json({ error: 'No valid account IDs found' });
      }
      
      console.log(`[USER TIKTOK VERIFY] Verifying ${accountIds.length} TikTok accounts`);
      
      // Get backend URL from environment or use default
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
      const backendEndpoint = `${apiBaseUrl}/users/${uid}/social/tiktok/verify`;
      
      console.log(`[USER TIKTOK VERIFY] Using backend endpoint: ${backendEndpoint}`);
      
      const response = await axios.post(backendEndpoint, accountIds, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[USER TIKTOK VERIFY] Backend response status:', response.status);
      
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER TIKTOK VERIFY] Error verifying TikTok accounts:', error?.response?.data || error.message);
      
      return res.status(error?.response?.status || 500).json({
        error: 'Error verifying TikTok accounts',
        details: error?.response?.data || error.message
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 