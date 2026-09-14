import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * Tracks OTP-generation attempts per device (not per phone number/User) so
 * that repeatedly hitting "resend OTP" from the same phone/app install gets
 * throttled even across different phone numbers. Used by
 * Controllers/AuthController/auth.controller.js (signupAndLogin and the
 * autoshopowner sign-up/login flow) — see checkAndRegisterOtpDeviceAttempt
 * in that file.
 */
const otpDeviceThrottleSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    // Kept in sync opportunistically so ops can see which device this was,
    // per the existing User.fcmToken field — not used for throttling logic.
    fcmToken: { type: String, default: null },
    // OTP-generation attempts within the current rolling window.
    attempts: { type: Number, default: 0 },
    windowStart: { type: Date, default: Date.now },
    // Set once `attempts` exceeds the allowed max; login/OTP requests from
    // this device are refused until this timestamp passes.
    blockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("OtpDeviceThrottle", otpDeviceThrottleSchema);