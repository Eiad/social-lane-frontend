import axios from 'axios';

export default async function handler(req, res) {
  console.log('[USER TWITTER] Request received:', req.method);
  
  if (req.method === 'POST') {
    try {
      const { uid } = req.query;
      
      if (!uid) {
        console.log('[USER TWITTER] Error: Missing user ID');
        return res.status(400).json({ error: 'Missing user ID' });
      }

      const requestData = req.body;
      let accountsData;
      
      // Handle both direct accounts array and wrapped accounts object
      if (requestData.accounts && Array.isArray(requestData.accounts)) {
        accountsData = requestData.accounts;
      } else if (Array.isArray(requestData)) {
        accountsData = requestData;
      } else {
        accountsData = [requestData];
      }
      
      if (!accountsData || accountsData.length === 0) {
        console.log('[USER TWITTER] Error: Invalid or empty accounts data');
        return res.status(400).json({ error: 'Invalid or empty accounts data' });
      }
      
      // Validate accounts
      const validatedAccounts = accountsData.map(account => ({
        accessToken: account?.accessToken || '',
        accessTokenSecret: account?.accessTokenSecret || '',
        userId: account.userId,
        username: account?.username || account?.screen_name || 'Twitter Account',
        name: account?.name || account?.displayName || '',
        profileImageUrl: account?.profileImageUrl || account?.profile_image_url || ''
      })).filter(account => account.userId);
      
      if (validatedAccounts.length === 0) {
        return res.status(400).json({ error: 'No valid Twitter accounts provided. Each account must have userId.' });
      }
      
      // Send to backend
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const backendEndpoint = `${apiBaseUrl}/users/${uid}/social/twitter`;
      
      const backendResponse = await axios.post(backendEndpoint, validatedAccounts, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      return res.status(backendResponse.status).json({
        success: true,
        message: 'Twitter accounts saved successfully',
        accounts: validatedAccounts.map(acc => ({
          userId: acc.userId,
          username: acc.username,
          name: acc.name
        }))
      });
    } catch (error) {
      console.error('[USER TWITTER] Error saving Twitter accounts:', error?.response?.data || error.message);
      
      // Handle duplicate account error
      if (error?.response?.data?.error?.includes('duplicate key error') || 
          error?.response?.data?.error?.includes('already connected')) {
        return res.status(409).json({
          success: false,
          error: 'This Twitter account is already connected to another user.',
          duplicateKeyError: true
        });
      }
      
      return res.status(error?.response?.status || 500).json({
        error: 'Error saving Twitter accounts to user profile',
        details: error?.response?.data || error.message
      });
    }
  } else if (req.method === 'GET') {
    try {
      const { uid } = req.query;
      
      if (!uid) {
        return res.status(400).json({ error: 'Missing user ID' });
      }
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const backendEndpoint = `${apiBaseUrl}/users/${uid}/social/twitter`;
      
      const response = await axios.get(backendEndpoint);
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[USER TWITTER] Error getting Twitter accounts:', error?.response?.data || error.message);
      return res.status(error?.response?.status || 500).json({
        error: 'Error getting Twitter accounts',
        details: error?.response?.data || error.message
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 