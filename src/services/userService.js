import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';

/**
 * Create or update a user in the database
 * @param {Object} userData - User data from Firebase
 * @returns {Promise<Object>} - Response from the API
 */
export const createOrUpdateUser = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/users`, userData);
    return response.data;
  } catch (error) {
    console.error('Error creating/updating user:', error?.response?.data || error.message);
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
    const response = await axios.get(`${API_URL}/users/${uid}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error?.response?.data || error.message);
    
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