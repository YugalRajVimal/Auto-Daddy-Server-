import admin from "../config/firebase";


const sendPushNotification = async ({ token, title, body, data = {} }) => {
  if (!token) {
    console.warn('[FCM] No token provided, skipping notification');
    return null;
  }

  try {
    const message = {
      token,
      notification: { title, body },
      data,                          // extra payload (all values must be strings)
      android: { priority: 'high' },
      apns: {
        payload: { aps: { sound: 'default' } }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('[FCM] Notification sent:', response);
    return response;
  } catch (error) {
    // Token expired or invalid — clear it from DB
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      console.warn('[FCM] Invalid token, should clear from DB');
    }
    console.error('[FCM] Error:', error.message);
    throw error;
  }
};

export default sendPushNotification;