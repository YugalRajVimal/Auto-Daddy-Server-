import firebaseAdmin from './firebase.js';

/**
 * Sends a push notification using Firebase Cloud Messaging.
 * 
 * @param {Object} params
 * @param {string} params.token - The FCM device token.
 * @param {Object} params.notification - Notification object { title, body }.
 * @param {Object} [params.data] - Optional data (key-value pairs) to send with the notification.
 * @returns {Promise<Object>} FCM result if successful. Throws if failed.
 */
export async function sendPushNotification({ token, notification, data }) {
  if (!token || typeof token !== 'string') throw new Error('FCM token is required.');
  if (!notification || typeof notification !== 'object' || !notification.title || !notification.body) {
    throw new Error('Notification { title, body } is required.');
  }

  const message = {
    token,
    notification: {
      title: String(notification.title),
      body: String(notification.body),
    },
    ...(data ? { data } : {})
  };

  try {
    const result = await firebaseAdmin.messaging().send(message);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message || err };
  }
}