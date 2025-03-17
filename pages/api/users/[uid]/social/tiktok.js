import axios from 'axios';

export default async function handler(req, res) {
  console.log('[USER TIKTOK] Request received');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ error: 'Missing user ID' });
    }

    const accountsData = req.body;
    
    if (!Array.isArray(accountsData) || accountsData.length === 0) {
      return res.status(400).json({ error: 'Invalid accounts data' });
    }

    // Ensure all accounts have the required fields
    const validatedAccounts = accountsData.map(account => ({
      accessToken: account?.accessToken || '',
      openId: account?.openId || '',
      refreshToken: account?.refreshToken || '',
      username: account?.username || account?.userInfo?.username || `TikTok Account ${account?.index || 0}`,
      displayName: account?.displayName || account?.userInfo?.display_name || '',
      avatarUrl: account?.avatarUrl || account?.userInfo?.avatar_url || '',
      avatarUrl100: account?.avatarUrl100 || account?.userInfo?.avatar_url_100 || '',
      index: account?.index || 0
    }));

    // Forward the request to the backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';
    const apiUrl = `${backendUrl}/users/${uid}/social/tiktok`;
    
    console.log('[USER TIKTOK] Forwarding request to backend:', apiUrl);
    console.log('[USER TIKTOK] Sending accounts data:', JSON.stringify(validatedAccounts.map(a => ({
      openId: a.openId,
      hasUsername: !!a.username,
      hasDisplayName: !!a.displayName,
      hasAvatarUrl: !!a.avatarUrl,
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
    
    // Return the response from the backend
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('[USER TIKTOK] Error saving accounts:', error);
    
    // Return appropriate error response
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
    
    return res.status(status).json({ 
      error: 'Error saving TikTok accounts', 
      details: errorMessage 
    });
  }
} 