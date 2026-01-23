
import jwt from "jsonwebtoken";
import {
  User
} from "../../Schema/user.schema.js";
import ExpiredTokenModel from "../../Schema/expired-token.schema.js";

// Allowed roles from user.schema.js (see enum in file_context_2 line 8)
const ALLOWED_ROLES = ["patient", "therapist", "admin", "carowner"];

class AuthController {

  signupAndLogin = async (req, res) => {
    try {
      let { countryCode, phone } = req.body;

      // Validate presence
      if (!countryCode || !phone) {
        return res.status(400).json({ message: "Phone code and phone are required" });
      }

      // Clean up values
      countryCode = countryCode.trim().replace(/^\+/, ""); // remove '+' if provided
      phone = phone.trim();

      // Basic validation for phone code and phone number
      if (!/^\d{1,4}$/.test(countryCode)) {
        return res.status(400).json({ message: "Invalid country code." });
      }
      if (!/^\d{5,15}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number." });
      }

      // Generate a 6-digit OTP for verification
      // const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otp = "000000";
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

      // Check if user exists
      let user = await User.findOne({ countryCode, phone });

      if (user) {
        // User exists: update OTP info and resend (for login)
        user.signUpOTP = otp;
        user.signUpOTPExpiresAt = otpExpiresAt;
        user.signUpOTPSentAt = new Date();
        user.signUpOTPAttempts = 0;
        await user.save();

        // Optionally, send the OTP via SMS here using full international format

        return res.status(200).json({
          message: "OTP sent successfully for login",
          userId: user._id
        });
      }

      // User does not exist: create new user with OTP info (sign up flow)
      user = await User.create({
        countryCode,
        phone: phone,
        authProvider: "otp",
        signUpOTP: otp,
        signUpOTPExpiresAt: otpExpiresAt,
        signUpOTPSentAt: new Date(),
        signUpOTPAttempts: 0,
        phoneVerified: false,
        emailVerified: false
      });

      // Optionally, send the OTP via SMS here using full international format

      return res.status(201).json({
        message: "Sign-up OTP sent successfully",
        userId: user._id // client uses this + OTP to verify
      });
    } catch (error) {
      console.error("Signup/Login Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

    // Verify Account with OTP (parent/therapist/admin/superadmin) using user.schema.js
    verifyAccount = async (req, res) => {
      try {
        let { countryCode, phone, otp } = req.body;

        console.log("[verifyAccount] Incoming params:", { countryCode, phone, otp });

        if (!countryCode || !phone || !otp) {
          console.log("[verifyAccount] Missing params:", { countryCode, phone, otp });
          return res.status(400).json({ message: "Country code, phone number, and OTP are required" });
        }

        countryCode = countryCode.trim().replace(/^\+/, "");
        phone = phone.trim();

        // Basic validation for countryCode and phone (reuse signup validation)
        if (!/^\d{1,4}$/.test(countryCode)) {
          console.log("[verifyAccount] Invalid country code.");
          return res.status(400).json({ message: "Invalid country code." });
        }
        if (!/^\d{5,15}$/.test(phone)) {
          console.log("[verifyAccount] Invalid phone number.");
          return res.status(400).json({ message: "Invalid phone number." });

        }

        const newCountryCode = countryCode.replace(/^\+/, "")

        // Try to find and update (atomic verify) by countryCode, phone, otp, and an active OTP period
        const user = await User.findOneAndUpdate(
          {
            countryCode: newCountryCode,
            phone,
            signUpOTP: otp,
          },
          {
            $unset: { signUpOTP: 1, signUpOTPExpiresAt: 1, signUpOTPSentAt: 1 },
            phoneVerified: true,
            lastLogin: new Date()
          },
          { new: true }
        ).lean();

        if (!user) {
          console.log("[verifyAccount] User NOT found or OTP expired/invalid for", {
            countryCode,
            phone,
            otp
          });
          return res.status(401).json({ message: "Invalid phone, country code, or OTP" });
        } else {
          console.log("[verifyAccount] Account verified: userId =", user._id);
        }

        // Generate JWT (payload may later use more fields as needed)
        const tokenPayload = {
          id: user._id,
          // Could include countryCode, phone, or other minimal info as needed
        };

        // Set token to expire in 1 day
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

        await ExpiredTokenModel.create({
          token,
          tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day expiry
        });

        console.log("[verifyAccount] Stored issued token in expired-tokens collection:", token);

        return res.status(200).json({
          message: "Account verified successfully",
          token
        });

      } catch (error) {
        console.error("[verifyAccount] Error:", error);
        return res.status(500).json({ message: "Internal Server Error" });
      }
    };

  // Check Authorization with user.schema.js roles & maintenance
  checkAuth = async (req, res) => {
    try {
      const { id } = req.user || {};

      // Check if user with provided id exists in the database
      const dbUser = await User.findOne({ _id: id });

      if (!dbUser) {
        return res.status(401).json({ message: "Unauthorized: User not found" });
      }

      // Check user status
      if (dbUser.status === "suspended") {
        return res.status(403).json({ message: "Your account has been suspended. Please contact support." });
      }
      if (dbUser.status === "deleted") {
        return res.status(403).json({ message: "Your account has been deleted. Please contact support." });
      }

      // Check if profile is complete
      if (dbUser.isProfileComplete === false) {
        // 428 Precondition Required
        return res.status(428).json({
          message: "Your profile is incomplete. Please complete your profile to continue.",
          phone: dbUser.phone
        });
      }

      return res.status(200).json({ message: "Verified" });
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  };





  // Sign In → Send OTP, only for known roles
  // signin = async (req, res) => {
  //   try {
  //     let { email, role } = req.body;

  //     if (!email || !role) {
  //       return res.status(400).json({ message: "Email and role are required" });
  //     }


  //     email = email.trim().toLowerCase();
  //     role = role.trim();

  //     console.log(email,role)

  //     if (!ALLOWED_ROLES.includes(role)) {
  //       return res.status(400).json({ message: "Invalid user role." });
  //     }

  //     const user = await User.findOne({ email, role }).lean();
  //     if (user && user.role !== role) {
  //       return res.status(400).json({ message: "Role does not match for this user." });
  //     }
  //     if (!user) {
  //       return res.status(404).json({ message: "User not found" });
  //     }

  //     // Generate 6-digit OTP
  //     // const otp = Math.floor(100000 + Math.random() * 900000).toString();

  //     // Save OTP with expiry (10 min)
  //     await User.findByIdAndUpdate(
  //       user._id,
  //       {
  //         otp:"000000",
  //         otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min expiry
  //       },
  //       { new: true }
  //     );

  //     // Send OTP via mail
  //     // sendMail(email, "Your OTP Code", `Your OTP is: ${otp}`).catch(console.error);

  //     return res.status(200).json({ message: "OTP sent successfully" });
  //   } catch (error) {
  //     console.error("Signin Error:", error);
  //     return res.status(500).json({ message: "Internal Server Error" });
  //   }
  // };

  // Sign Out → Mark token as immediately expired
  signOut = async (req, res) => {
    try {
      // Get token from Authorization header
      const token = req.headers["authorization"];
      if (!token) {
        return res.status(401).json({ message: "Unauthorized: Token missing" });
      }

      // Set tokenExpiry to now so it is immediately considered expired
      const now = new Date();

      await ExpiredTokenModel.create({
        token,
        tokenExpiry: now,
      });

      return res.status(200).json({ message: "Signed out successfully" });
    } catch (error) {
      console.error("SignOut Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };
}

export default AuthController;
