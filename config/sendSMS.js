// import { Vonage } from '@vonage/server-sdk';
// import { Channels } from '@vonage/messages';

// // Replace with your actual API credentials and numbers
// const vonage = new Vonage({
//   apiKey: process.env.VONAGE_API_KEY,
//   apiSecret: process.env.VONAGE_API_SECRET ,
// });

// const smsPayload = {
//   messageType: 'text',
//   channel: Channels.SMS,
//   text: 'This is an SMS text message sent using the Vonage Messages API',
//   to: '919410918680',
//   from: 'Auto Daddy',
// };

// vonage.messages.send(smsPayload)
//   .then(({ messageUUID }) => console.log(messageUUID))
//   .catch((error) => console.error(error));

  import { Vonage } from "@vonage/server-sdk";
import { Channels } from "@vonage/messages";

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const DEFAULT_FROM = process.env.VONAGE_SMS_FROM || "Auto Daddy";

/**
 * Send a plain-text SMS via Vonage.
 *
 * @param {string} to      - Recipient phone number, E.164-style digits only,
 *                            no leading "+" (e.g. "919410918680" for an
 *                            Indian number with country code).
 * @param {string} text    - The SMS body.
 * @param {string} [from]  - Sender ID / name shown to the recipient.
 *                            Defaults to VONAGE_SMS_FROM env var, or
 *                            "Auto Daddy" if that's not set either.
 *
 * @returns {Promise<{ success: true, messageUUID: string } | { success: false, error: string }>}
 *          Never throws — callers get a plain result object back so a
 *          failed SMS (e.g. OTP delivery) doesn't crash the request; the
 *          calling controller decides how to handle a failure (retry,
 *          surface to the user, log and continue, etc).
 */
export async function sendSms(to, text, from = DEFAULT_FROM) {
  if (!to || typeof to !== "string" || !to.trim()) {
    return { success: false, error: "Recipient phone number ('to') is required" };
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return { success: false, error: "SMS text is required" };
  }

  // Vonage expects digits only, no "+", no spaces/dashes.
  const normalizedTo = to.replace(/[^\d]/g, "");
  if (!normalizedTo) {
    return { success: false, error: `Invalid phone number: "${to}"` };
  }

  try {
    const { messageUUID } = await vonage.messages.send({
      messageType: "text",
      channel: Channels.SMS,
      text,
      to: normalizedTo,
      from,
    });

    return { success: true, messageUUID };
  } catch (error) {
    // Vonage SDK errors can come back as either an Error instance or a
    // response-shaped object depending on failure type — normalize to a
    // plain string so callers/logs don't choke on unexpected shapes.
    const message =
      error?.response?.data?.title ||
      error?.message ||
      (typeof error === "string" ? error : "Unknown SMS send error");

    console.error("[sendSms] Failed to send SMS:", { to: normalizedTo, error: message });

    return { success: false, error: message };
  }
}