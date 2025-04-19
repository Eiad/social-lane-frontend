import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Create or update a user in the database
 * @param {Object} userData - User data from Firebase
 * @returns {Promise<Object>} - Response from the API
 */
export const createOrUpdateUser = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/users`, userData);
    return response?.data;
  } catch (error) {
    console.error('Error creating/updating user:', error?.response?.data || error?.message);
    throw error;
  }
};

/**
 * Get a user by UID
 * @param {string} uid - Firebase UID
 * @returns {Promise<Object>} - User data
 */
export const getUserByUid = async (uid) => {
  try {
    if (!uid) {
      console.error('No UID provided to getUserByUid');
      return { success: false, data: null };
    }
    
    const response = await axios.get(`${API_URL}/users/${uid}`);
    return response?.data;
  } catch (error) {
    console.error('Error fetching user:', error?.response?.data || error?.message);
    
    // If user not found, return null instead of throwing
    if (error?.response?.status === 404) {
      return { success: false, data: null };
    }
    
    throw error;
  }
};

/**
 * Check if a user has Pro role
 * @param {string} uid - Firebase UID
 * @returns {Promise<boolean>} - Whether the user has Pro role
 */
export const checkUserProStatus = async (uid) => {
  try {
    const response = await getUserByUid(uid);
    return response?.data?.role === 'Pro';
  } catch (error) {
    console.error('Error checking Pro status:', error);
    return false;
  }
};

/**
 * Get user limits and features by UID
 * @param {string} uid - Firebase UID
 * @returns {Promise<Object>} - User limits data
 */
export const getUserLimits = async (uid) => {
  try {
    if (!uid) {
      console.error('No UID provided to getUserLimits');
      return { success: false, data: null };
    }
    
    const response = await axios.get(`${API_URL}/users/${uid}/limits`);
    return response?.data; // Should contain { success: true, data: { ...limits } }
  } catch (error) {
    console.error('Error fetching user limits:', error?.response?.data || error?.message);
    // Return error structure consistent with backend
    return { 
      success: false, 
      error: error?.response?.data?.error || 'Failed to fetch limits',
      data: null 
    };
  }
};

/**
 * Get post usage statistics for a user
 * @param {string} uid - Firebase UID
 * @returns {Promise<Object>} - Post usage data
 */
export const getPostUsage = async (uid) => {
  try {
    if (!uid) {
      console.error('No UID provided to getPostUsage');
      return { success: false, data: null };
    }
    
    const response = await axios.get(`${API_URL}/users/${uid}/post-usage`);
    return response?.data; // Should contain { success: true, data: { ...usage } }
  } catch (error) {
    console.error('Error fetching post usage:', error?.response?.data || error?.message);
    // Return error structure consistent with backend
    return { 
      success: false, 
      error: error?.response?.data?.error || 'Failed to fetch post usage',
      data: null 
    };
  }
}; 