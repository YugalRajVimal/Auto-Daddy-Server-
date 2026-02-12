
import jwt from "jsonwebtoken";
import {
  User
} from "../../Schema/user.schema.js";
import ExpiredTokenModel from "../../Schema/expired-token.schema.js";
import { Admin } from "../../Schema/admin.schema.js";

// Allowed roles from user.schema.js (see enum in file_context_2 line 8)
const ALLOWED_ROLES = ["patient", "therapist", "admin", "carowner", "autoshopowner"];

class AuthController {

  // Uses standard OTP fields per user.schema.js (lines 43-48)
  signupAndLogin = async (req, res) => {
    try {
      let { countryCode, phone, email } = req.body;

      // Validate required
      if (!countryCode || !phone) {
        return res.status(400).json({ message: "Phone code and phone are required" });
      }

      // Clean formatting (do not remove +)
      countryCode = countryCode.trim(); // Preserve leading '+'
      phone = phone.trim();
      if (email) email = email.trim().toLowerCase();

      // Validate
      if (!/^\+?\d{1,4}$/.test(countryCode)) {
        // Allow optional leading +
        return res.status(400).json({ message: "Invalid country code." });
      }
      if (!/^\d{5,15}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number." });
      }

      // Use standard OTP field: otp, otpExpiresAt, otpGeneratedAt, otpAttempts
      // const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otp = "000000";
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
      const otpGeneratedAt = new Date();

      // Try to find user by countryCode/phone
      let user = await User.findOne({ countryCode, phone });

      if (user) {
        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        user.otpGeneratedAt = otpGeneratedAt;
        user.otpAttempts = 0;
        await user.save();

        return res.status(200).json({
          message: "OTP sent successfully for login",
          userId: user._id,
        });
      }

      // BEFORE creating new, check if email or phone already exists on another user
      // (shouldn't happen if proper check on user collection, but for safety)
      if (email) {
        const existingEmailUser = await User.findOne({ email: email });
        if (existingEmailUser) {
          return res.status(409).json({
            message: "User with this email already exists.",
            userId: existingEmailUser._id
          });
        }
      }
      const existingPhoneUser = await User.findOne({ countryCode, phone });
      if (existingPhoneUser) {
        // Unlikely to occur (we checked above), but extra safety
        return res.status(409).json({
          message: "User with this phone already exists.",
          userId: existingPhoneUser._id
        });
      }

      // Create new user using standard schema fields (no custom signUpOTP* fields)
      user = await User.create({
        countryCode,
        phone,
        email: email || undefined,
        otp,
        otpExpiresAt,
        otpGeneratedAt,
        otpAttempts: 0,
        phoneVerified: false,
        emailVerified: false
      });

      return res.status(201).json({
        message: "Sign-up OTP sent successfully",
        userId: user._id
      });

    } catch (error) {
      console.error("Signup/Login Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // Verify Account with OTP per user.schema.js fields
  verifyAccount = async (req, res) => {
    try {
      let { countryCode, phone, otp } = req.body;
      console.log("[verifyAccount] Incoming params:", { countryCode, phone, otp });

      if (!countryCode || !phone || !otp) {
        console.log("[verifyAccount] Missing params:", { countryCode, phone, otp });
        return res.status(400).json({ message: "Country code, phone number, and OTP are required" });
      }

      countryCode = countryCode.trim();
      phone = phone.trim();

      // Validate country code format
      if (!/^\+\d{1,4}$/.test(countryCode)) {
        console.log("[verifyAccount] Invalid country code.");
        return res.status(400).json({ message: "Invalid country code." });
      }
      if (!/^\d{5,15}$/.test(phone)) {
        console.log("[verifyAccount] Invalid phone number.");
        return res.status(400).json({ message: "Invalid phone number." });
      }

      // Find user with matching phone and code
      const user = await User.findOne({ countryCode, phone });

      if (!user) {
        console.log("[verifyAccount] User NOT found for", { countryCode, phone });
        return res.status(401).json({ message: "Invalid phone or country code" });
      }

      // Check OTP and expiry with schema fields
      if (!user.otp || !user.otpExpiresAt) {
        console.log("[verifyAccount] OTP not present or expired fields missing.");
        return res.status(401).json({ message: "OTP not sent, please request again." });
      }
      if (user.otp !== otp) {
        return res.status(401).json({ message: "Invalid OTP" });
      }
      if (user.otpExpiresAt < new Date()) {
        return res.status(401).json({ message: "OTP has expired. Please request a new OTP." });
      }

      // Update fields for verified user; clear OTP and set phoneVerified
      user.otp = null;
      user.otpExpiresAt = null;
      user.otpGeneratedAt = null;
      user.otpAttempts = 0;
      user.phoneVerified = true;
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT
      const tokenPayload = { id: user._id };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

      await ExpiredTokenModel.create({
        token,
        tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      });

      console.log("[verifyAccount] Account verified: userId =", user._id);

      // Send name and profilePhoto along with other needed fields
      return res.status(200).json({
        message: "Account verified successfully",
        token,
        isProfileComplete: user.isProfileComplete,
        role: user.role,
        name: user.name || null,
        profilePhoto: user.profilePhoto || null
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

      // Check if user is an autoshopowner and, if so, require their auto shop business profile to be completed
      if (dbUser.role === "autoshopowner" && !dbUser.isAutoShopBusinessProfileComplete) {
        // 428 Precondition Required
        return res.status(428).json({
          message: "Your auto shop business profile is incomplete. Please complete your business profile to continue.",
          phone: dbUser.phone
        });
      }

      return res.status(200).json({ message: "Verified" });
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  };

  completeProfile = async (req, res) => {
    try {
      // Ensure that the controller is behind jwtAuth middleware so req.user exists
      const { id } = req.user || {};

      // Get fields directly from req.body (name, email, pincode, role, address)
      const { name, email, pincode, role, address } = req.body;

      // All fields are mandatory (including address now)
      if (!name || !email || !pincode || !role || !address) {
        return res.status(400).json({
          message: "All fields (name, email, pincode, role, address) are required."
        });
      }

      // Only valid roles are 'carowner' and 'autoshopowner'
      const validRoles = ["carowner", "autoshopowner"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: "Invalid role provided. Allowed roles: carowner/autoshopowner"
        });
      }

      if (!id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Find user by id
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // Check if profile is already complete
      if (user.isProfileComplete) {
        return res.status(400).json({ message: "Profile already completed." });
      }

      // Check if email is already in use by another user
      const emailExists = await User.findOne({
        email: email,
        _id: { $ne: id }
      });
      if (emailExists) {
        return res.status(409).json({
          message: "Email is already in use by another account.",
          existingUserId: emailExists._id
        });
      }

      // All fields are mandatory, so no need to check for undefined, update directly
      const profileUpdates = {
        name,
        email,
        pincode,
        role,
        address,
        isProfileComplete: true
      };

      // Update and return user
      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $set: profileUpdates },
        { new: true }
      ).lean();

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update profile." });
      }

      return res.status(200).json({
        message: "Profile completed successfully.",
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          pincode: updatedUser.pincode,
          role: updatedUser.role,
          address: updatedUser.address,
          isProfileComplete: updatedUser.isProfileComplete,
        }
      });
    } catch (error) {
      console.error("[completeProfile] Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
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



  // Admin: Check Auth (admin dashboard)
  adminCheckAuth = async (req, res) => {
    try {
      const { id, role } = req.user || {};
      if (!id || role !== "admin") {
        return res.status(401).json({ message: "Unauthorized: Admin only" });
      }

      const admin = await Admin.findOne({ _id: id, role: "admin" });
      if (!admin) {
        return res.status(401).json({ message: "Admin not found" });
      }

      // No status or suspend support in Admin schema, so skip
      return res.status(200).json({
        message: "Admin authorized",
        name: admin.name,
        email: admin.email
      });
    } catch (error) {
      console.error("[adminCheckAuth] Error encountered:", error);
      return res.status(401).json({ message: "Unauthorized" });
    }
  };

  // Admin: Sign In → Send OTP
  adminSignin = async (req, res) => {
    try {
      let { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      email = email.trim().toLowerCase();
      role = role.trim();

      if (role !== "admin") {
        return res.status(400).json({ message: "Role must be admin for this endpoint" });
      }

      const admin = await Admin.findOne({ email, role: "admin" }).lean();
      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      // Generate 6-digit OTP (or 000000 in dev)
      // const otp = Math.floor(100000 + Math.random() * 900000).toString();
      // For now, set constant OTP
      const otp = "000000";

      // Save OTP with expiry (10 min)
      await Admin.findByIdAndUpdate(
        admin._id,
        {
          otp,
          otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          otpGeneratedAt: new Date(),
          otpAttempts: 0
        },
        { new: true }
      );

      // Optionally: Send OTP via email

      return res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("AdminSignin Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // Admin: Verify OTP & Generate Token
  adminVerifyAccount = async (req, res) => {
    try {
      let { email, otp, role } = req.body;

      if (!email || !otp || !role) {
        return res.status(400).json({ message: "Email, OTP, and Role are required" });
      }

      email = email.trim().toLowerCase();
      role = role.trim();

      if (role !== "admin") {
        return res.status(400).json({ message: "Invalid user role." });
      }

      // Find admin by email, role and OTP
      const admin = await Admin.findOneAndUpdate(
        {
          email,
          role: "admin",
          otp
        },
        { $unset: { otp: 1 }, lastLogin: new Date(), otpExpiresAt: 1, otpAttempts: 1, otpGeneratedAt: 1 },
        { new: true }
      ).lean();

      if (!admin) {
        return res.status(401).json({ message: "Invalid credentials or OTP" });
      }

      // Generate token
      const tokenPayload = {
        id: admin._id,
        email: admin.email,
        role: "admin"
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

      // NOTE: Do NOT log tokens for admin into ExpiredTokenModel at creation time (that would immediately revoke),
      // only mark them expired on signout. So this is omitted here.

      return res
        .status(200)
        .json({ message: "Account verified successfully", token });
    } catch (error) {
      console.error("AdminVerifyAccount Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

}

export default AuthController;
