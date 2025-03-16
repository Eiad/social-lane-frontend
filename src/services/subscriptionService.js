import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sociallane-backend.mindio.chat';

/**
 * Create a PayPal subscription for a user
 * @param {string} uid - User ID
 * @returns {Promise<Object>} - Subscription details with approval URL
 */
export const createSubscription = async (uid) => {
  try {
    console.log(`Creating subscription for user: ${uid}`);
    const response = await axios.post(`${API_URL}/paypal/create-subscription`, { uid });
    console.log('Subscription created successfully:', response?.data);
    return response?.data;
  } catch (error) {
    console.error('Error creating subscription:', error?.response?.data || error?.message);
    throw error;
  }
};

/**
 * Get subscription details for a user
 * @param {string} uid - User ID
 * @returns {Promise<Object>} - Subscription details
 */
export const getSubscription = async (uid) => {
  try {
    console.log(`Fetching subscription details for user: ${uid}`);
    const response = await axios.get(`${API_URL}/paypal/${uid}/subscription`);
    
    // Log the full response data
    console.log(`Full subscription response for user ${uid}:`, JSON.stringify(response?.data));
    
    // Log the subscription status
    if (response?.data?.success) {
      if (response?.data?.data?.hasSubscription) {
        console.log(`Subscription status for user ${uid}: ${response?.data?.data?.status}`);
        console.log(`Subscription end date for user ${uid}: ${response?.data?.data?.subscriptionEndDate || 'not set'}`);
      } else {
        console.log(`User ${uid} has no active subscription`);
      }
    }
    
    return response?.data;
  } catch (error) {
    console.error('Error getting subscription:', error?.response?.data || error?.message);
    throw error;
  }
};

/**
 * Cancel a subscription for a user
 * @param {string} uid - User ID
 * @param {string} reason - Reason for cancellation
 * @returns {Promise<Object>} - Cancellation result
 */
export const cancelSubscription = async (uid, reason = 'Cancelled by user') => {
  try {
    console.log(`Cancelling subscription for user: ${uid}, reason: ${reason}`);
    
    // First, get the current subscription details to verify it exists and is active
    const subscriptionResponse = await getSubscription(uid);
    
    if (!subscriptionResponse?.success || !subscriptionResponse?.data?.hasSubscription) {
      console.error(`No active subscription found for user: ${uid}`);
      throw new Error('No active subscription found');
    }
    
    if (subscriptionResponse?.data?.status === 'CANCELLED') {
      console.log(`Subscription for user ${uid} is already cancelled`);
      return { success: true, message: 'Subscription is already cancelled' };
    }
    
    // Proceed with cancellation
    const response = await axios.post(`${API_URL}/paypal/${uid}/cancel-subscription`, { reason });
    console.log(`Subscription cancelled successfully for user: ${uid}`);
    
    // Verify the cancellation by getting the subscription details again
    setTimeout(async () => {
      try {
        const verifyResponse = await getSubscription(uid);
        console.log(`Verified subscription status after cancellation: ${verifyResponse?.data?.status || 'N/A'}`);
      } catch (error) {
        console.error('Error verifying cancellation:', error);
      }
    }, 2000);
    
    return response?.data;
  } catch (error) {
    console.error('Error cancelling subscription:', error?.response?.data || error?.message);
    throw error;
  }
};

/**
 * Manually check for expired subscriptions
 * @returns {Promise<Object>} - Result of the check
 */
export const checkExpiredSubscriptions = async () => {
  try {
    console.log('Manually checking for expired subscriptions');
    const response = await axios.post(`${API_URL}/paypal/check-expired-subscriptions`);
    console.log('Expired subscription check result:', response?.data);
    return response?.data;
  } catch (error) {
    console.error('Error checking expired subscriptions:', error?.response?.data || error?.message);
    throw error;
  }
}; 