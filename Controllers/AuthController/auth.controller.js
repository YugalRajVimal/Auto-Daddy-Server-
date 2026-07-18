
import jwt from "jsonwebtoken";
import {
  User
} from "../../Schema/user.schema.js";
import ExpiredTokenModel from "../../Schema/expired-token.schema.js";
import { Admin } from "../../Schema/admin.schema.js";
import { SubAdminActivity } from "../../Schema/subadmin-activity.schema.js";
import { SubAdmin } from "../../Schema/subadmin.schema.js";

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
      countryCode = countryCode.trim();
      phone = phone.trim();
      countryCode = countryCode.replace(/\s+/g, "");
      phone = phone.replace(/\s+/g, "");
      if (email) email = email.trim().toLowerCase();

      // Allow only specific country codes
      const allowedCountryCodes = ["+1", "+61", "+44", "+91"];
      if (!allowedCountryCodes.includes(countryCode)) {
        return res.status(400).json({ 
          message: "Invalid country code. Allowed: +1 (Canada/United States), +61 (Australia), +44 (United Kingdom), +91 (India)." 
        });
      }

      if (!/^\+?\d{1,4}$/.test(countryCode)) {
        return res.status(400).json({ message: "Invalid country code format." });
      }
      if (!/^\d{5,15}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number." });
      }

      // Only allow login for existing users -- no user creation here
      // Only fetch the necessary fields (_id and fields to be updated)
      let user = await User.findOne({ countryCode, phone }).select("_id otp otpExpiresAt otpGeneratedAt otpAttempts");

      if (!user) {
        // No user found for this phone/countryCode
        return res.status(404).json({ message: "User with this phone does not exist." });
      }

      // Use standard OTP fields
      // const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otp = "000000";
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
      const otpGeneratedAt = new Date();

      // Only update the fields that are being set, avoid retrieving the full doc
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            otp: otp,
            otpExpiresAt: otpExpiresAt,
            otpGeneratedAt: otpGeneratedAt,
            otpAttempts: 0
          }
        }
      );

      return res.status(200).json({
        message: "OTP sent successfully for login",
        userId: user._id,
      });

    } catch (error) {
      console.error("Signup/Login Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
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


  /**
 * Combined Signup/Login and Complete Profile for Autoshop Owners
 * Only supports autoshopowner role.
 * Expects: countryCode, phone, email, name, pincode, address
 */
  signUpLogInAndCompleteProfileAutoShopOwner = async (req, res) => {
    try {
      let { countryCode, phone, email, name, pincode, address } = req.body;

      // All required fields for profile + phone
      if (!countryCode || !phone || !email || !name || !pincode || !address) {
        return res.status(400).json({
          message: "All fields (countryCode, phone, email, name, pincode, address) are required."
        });
      }

      // Only allow autoshopowner role
      const role = "autoshopowner";

      // Input normalization
      countryCode = countryCode.trim();
      phone = phone.trim();
      email = email.trim().toLowerCase();
      name = name.trim();
      pincode = pincode.toString().trim();
      address = typeof address === "string" ? address.trim() : address;

      // Field Validations
      if (!/^\+?\d{1,4}$/.test(countryCode)) {
        return res.status(400).json({ message: "Invalid country code." });
      }
      if (!/^\d{5,15}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number." });
      }
      if (!name) {
        return res.status(400).json({ message: "Name is required." });
      }
      if (!email || !/^[\w\-.]+@[\w\-]+\.[a-zA-Z]{2,}$/.test(email)) {
        return res.status(400).json({ message: "A valid email is required." });
      }
      if (!pincode) {
        return res.status(400).json({ message: "Pincode is required." });
      }
      if (!address) {
        return res.status(400).json({ message: "Address is required." });
      }

      // Use standard OTP field
      // const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otp = "000000";
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const otpGeneratedAt = new Date();

      // Lookup by countryCode/phone
      let user = await User.findOne({ countryCode, phone });

      // If user exists
      if (user) {
        // Only support autoshopowner for this flow
        if (user.role !== role) {
          return res.status(409).json({
            message: "User exists but is not an autoshopowner.",
            userId: user._id
          });
        }
        // Trigger login OTP and (optionally) update incomplete profile
        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        user.otpGeneratedAt = otpGeneratedAt;
        user.otpAttempts = 0;

        // If profile is not complete, patch profile fields
        if (!user.isProfileComplete) {
          user.name = name;
          user.email = email;
          user.pincode = pincode;
          user.address = address;
          user.role = role;
        }
        await user.save();

        return res.status(200).json({
          message: user.isProfileComplete
            ? "OTP sent successfully for login"
            : "OTP sent and profile details updated.",
          userId: user._id
        });
      }

      // BEFORE creating new, check if email or phone already exists
      const existingEmailUser = await User.findOne({ email: email });
      if (existingEmailUser) {
        return res.status(409).json({
          message: "User with this email already exists.",
          userId: existingEmailUser._id
        });
      }
      const existingPhoneUser = await User.findOne({ countryCode, phone });
      if (existingPhoneUser) {
        return res.status(409).json({
          message: "User with this phone already exists.",
          userId: existingPhoneUser._id
        });
      }

      // Create new autoshopowner user
      user = await User.create({
        countryCode,
        phone,
        email,
        name,
        pincode,
        address,
        role,
        otp,
        otpExpiresAt,
        otpGeneratedAt,
        otpAttempts: 0,
        phoneVerified: false,
        emailVerified: false,
        isProfileComplete: true
      });

      return res.status(201).json({
        message: "Sign-up, OTP sent, and profile completed successfully",
        userId: user._id
      });

    } catch (error) {
      console.error("[signUpLogInAndCompleteProfile/autoshopowner] Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // Verify Account with OTP per user.schema.js fields
  verifyAccount = async (req, res) => {
    try {
      let { countryCode, phone, otp, deviceId, fcmToken } = req.body;
      console.log("[verifyAccount] Incoming params:", req.body);

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

      // Fetch only necessary fields, including fcmToken
      let user = await User.findOne(
        { countryCode, phone },
        "_id otp otpExpiresAt otpGeneratedAt otpAttempts phoneVerified lastLogin role name profilePhoto isProfileComplete isAutoShopBusinessProfileComplete businessProfile fcmToken"
      );
      
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

      // Update fields for verified user; clear OTP and set phoneVerified, save deviceId and fcmToken if provided
      // Only update minimal required fields
      const updateObj = {
        otp: null,
        otpExpiresAt: null,
        otpGeneratedAt: null,
        otpAttempts: 0,
        phoneVerified: true,
        lastLogin: new Date()
      };
      if (deviceId) {
        updateObj.deviceId = deviceId;
      }
      if (typeof fcmToken === "string" && fcmToken.trim().length > 0) {
        updateObj.fcmToken = fcmToken.trim();
      }
      await User.updateOne({ _id: user._id }, { $set: updateObj });

      // Generate JWT and save role in token payload
      const tokenPayload = { id: user._id, role: user.role };
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);

      await ExpiredTokenModel.create({
        token,
        tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      });

      console.log("[verifyAccount] Account verified: userId =", user._id);

      // Need to fetch businessLogo if user is autoshopowner
      let profilePhoto = user.profilePhoto || null;
      if (user.role === "autoshopowner" && user.businessProfile) {
        // Only fetch businessLogo if needed; otherwise, we never fetch all businessProfile
        const businessProfileData = await User.findById(user._id)
          .select("businessProfile")
          .populate({ path: "businessProfile", select: "businessLogo" });

        if (businessProfileData && businessProfileData.businessProfile && businessProfileData.businessProfile.businessLogo) {
          profilePhoto = businessProfileData.businessProfile.businessLogo;
        }
      }

      return res.status(200).json({
        message: "Account verified successfully",
        token,
        isProfileComplete: user.isProfileComplete,
        isAutoShopBusinessProfileComplete: user.isAutoShopBusinessProfileComplete,
        role: user.role,
        name: user.name || null,
        profilePhoto: profilePhoto,
        fcmToken: (typeof fcmToken === "string" && fcmToken.trim().length > 0) ? fcmToken.trim() : user.fcmToken || null
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



  /**
   * Combined Signup/Login and Complete Profile for Autoshop Owners
   * Only supports autoshopowner role.
   * Expects: countryCode, phone, email, name, pincode, address
   */
  signUpLogInAndCompleteProfileAutoShopOwner = async (req, res) => {
    try {
      let { countryCode, phone, email, name, pincode, address } = req.body;

      // All required fields for profile + phone
      if (!countryCode || !phone || !email || !name || !pincode || !address) {
        return res.status(400).json({
          message: "All fields (countryCode, phone, email, name, pincode, address) are required."
        });
      }

      // Only allow autoshopowner role
      const role = "autoshopowner";

      // Input normalization
      countryCode = countryCode.trim();
      phone = phone.trim();
      email = email.trim().toLowerCase();
      name = name.trim();
      pincode = pincode.toString().trim();
      address = typeof address === "string" ? address.trim() : address;

      // Field Validations
      if (!/^\+?\d{1,4}$/.test(countryCode)) {
        return res.status(400).json({ message: "Invalid country code." });
      }
      if (!/^\d{5,15}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number." });
      }
      if (!name) {
        return res.status(400).json({ message: "Name is required." });
      }
      if (!email || !/^[\w\-.]+@[\w\-]+\.[a-zA-Z]{2,}$/.test(email)) {
        return res.status(400).json({ message: "A valid email is required." });
      }
      if (!pincode) {
        return res.status(400).json({ message: "Pincode is required." });
      }
      if (!address) {
        return res.status(400).json({ message: "Address is required." });
      }

      // Use standard OTP field
      // const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otp = "000000";
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const otpGeneratedAt = new Date();

      // Lookup by countryCode/phone
      let user = await User.findOne({ countryCode, phone });

      // If user exists
      if (user) {
        // Only support autoshopowner for this flow
        if (user.role !== role) {
          return res.status(409).json({
            message: "User exists but is not an autoshopowner.",
            userId: user._id
          });
        }
        // Trigger login OTP and (optionally) update incomplete profile
        user.otp = otp;
        user.otpExpiresAt = otpExpiresAt;
        user.otpGeneratedAt = otpGeneratedAt;
        user.otpAttempts = 0;

        // If profile is not complete, patch profile fields
        if (!user.isProfileComplete) {
          user.name = name;
          user.email = email;
          user.pincode = pincode;
          user.address = address;
          user.role = role;
        }
        await user.save();

        return res.status(200).json({
          message: user.isProfileComplete
            ? "OTP sent successfully for login"
            : "OTP sent and profile details updated.",
          userId: user._id
        });
      }

      // BEFORE creating new, check if email or phone already exists
      const existingEmailUser = await User.findOne({ email: email });
      if (existingEmailUser) {
        return res.status(409).json({
          message: "User with this email already exists.",
          userId: existingEmailUser._id
        });
      }
      const existingPhoneUser = await User.findOne({ countryCode, phone });
      if (existingPhoneUser) {
        return res.status(409).json({
          message: "User with this phone already exists.",
          userId: existingPhoneUser._id
        });
      }

      // Create new autoshopowner user
      user = await User.create({
        countryCode,
        phone,
        email,
        name,
        pincode,
        address,
        role,
        otp,
        otpExpiresAt,
        otpGeneratedAt,
        otpAttempts: 0,
        phoneVerified: false,
        emailVerified: false,
        isProfileComplete: true
      });

      return res.status(201).json({
        message: "Sign-up, OTP sent, and profile completed successfully",
        userId: user._id
      });

    } catch (error) {
      console.error("[signUpLogInAndCompleteProfile/autoshopowner] Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }


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
      if (!id || !["admin", "subadmin"].includes(role)) {
        return res.status(401).json({ message: "Unauthorized: Admin/Subadmin only" });
      }

      if (role === "admin") {
        const admin = await Admin.findOne({ _id: id, role: "admin" });
        if (!admin) {
          return res.status(401).json({ message: "Admin not found" });
        }
        return res.status(200).json({
          message: "Admin authorized",
          name: admin.name,
          email: admin.email
        });
      } else if (role === "subadmin") {
        const subAdmin = await SubAdmin.findById(id).select("-password");
        if (!subAdmin || !subAdmin.isActive)
          return res.status(401).json({ message: "Unauthorized: Subadmin not found or inactive" });

        return res.status(200).json({
          message: "Subadmin authorized",
          name: subAdmin.name,
          email: subAdmin.email,
          permissions: subAdmin.permissions,
        });
      } else {
        // Should not reach here
        return res.status(401).json({ message: "Unauthorized: Invalid role" });
      }
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


 
/**
 * POST /api/auth/subadmin/login
 * Password-based login for SubAdmins.
 * Returns JWT with { id, role, permissions }.
 */
 subAdminLogin = async(req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password are required." });
 
    const subAdmin = await SubAdmin.findOne({ email: email.trim().toLowerCase() });
    if (!subAdmin)
      return res.status(401).json({ success: false, message: "Invalid credentials." });
 
    if (!subAdmin.isActive)
      return res.status(403).json({ success: false, message: "Account inactive. Contact the admin." });
 
    const valid = await subAdmin.comparePassword(password);
    if (!valid)
      return res.status(401).json({ success: false, message: "Invalid credentials." });
 
    subAdmin.lastLogin = new Date();
    await subAdmin.save();
 
    const token = jwt.sign(
      { id: subAdmin._id, role: "subadmin", permissions: subAdmin.permissions },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
 
    // Log activity
    try {
      await SubAdminActivity.create({
        performedBy: subAdmin._id,
        performedByRole: "subadmin",
        performedByName: subAdmin.name,
        action: "LOGIN",
        description: "SubAdmin logged in",
        targetSubAdmin: subAdmin._id,
        ipAddress: req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "",
      });
    } catch { /* non-fatal */ }
 
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: subAdmin._id,
        name: subAdmin.name,
        email: subAdmin.email,
        role: "subadmin",
        permissions: subAdmin.permissions,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Login failed", error: err.message });
  }
}
 
/**
 * POST /api/auth/subadmin/check-auth
 * Verify a subadmin token is still valid and return user info.
 */
   subAdminCheckAuth =async (req, res) =>{
  try {
    const subAdmin = await SubAdmin.findById(req.user.id).select("-password");
    if (!subAdmin || !subAdmin.isActive)
      return res.status(401).json({ success: false, message: "Unauthorized" });
 
    return res.status(200).json({
      success: true,
      name: subAdmin.name,
      email: subAdmin.email,
      permissions: subAdmin.permissions,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/auth/loginas
 * Superadmin "login as" another user (carowner or autoshopowner) by userId.
 * Requires: req.user.role === "admin" (superadmin)
 * Body params: { userId }
 * Returns: { success, token, user }
 */
loginAs = async (req, res) => {
  try {
    // Only allow superadmin/admin
    if (!req.user || req.user.role !== "admin") {
      console.log("Access denied: Not admin or no req.user:", req.user);
      return res.status(403).json({ success: false, message: "Forbidden: Only superadmin can login as another user." });
    }

    const { userId } = req.body;
    if (!userId) {
      console.log("loginAs - Missing userId in body:", req.body);
      return res.status(400).json({ success: false, message: "userId is required." });
    }

    // Find user (only carowner or autoshopowner)
    const user = await User.findOne({
      _id: userId,
      role: { $in: ["carowner", "autoshopowner"] },
    }).select("-password");

    if (!user) {
      console.log(`loginAs - User not found or not allowed: userId=${userId}`);
      return res.status(404).json({ success: false, message: "User not found or not eligible for loginAs." });
    }

    // Fail fast on suspended/deleted (middleware also enforces this on every request)
    if (["suspended", "deleted"].includes(user.status)) {
      console.log(`loginAs - User ${user._id} is ${user.status}; denied impersonation`);
      return res.status(403).json({
        success: false,
        message: `Cannot login as a ${user.status} user.`,
      });
    }

    // Shorter-lived token for impersonation sessions, flagged so the
    // frontend can show an "Exit impersonation" banner and so you can
    // add extra guards later (e.g. block password/email change routes
    // when isImpersonation is true).
    const tokenPayload = {
      id: user._id,
      role: user.role,
      impersonatedBy: req.user.id,
      isImpersonation: true,
    };
    console.log(`loginAs - Creating impersonation token for user ${user._id} by ${req.user.id}`);

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    console.log(token);


    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.log("loginAs - Exception:", err);
    return res.status(500).json({ success: false, message: "loginAs failed", error: err.message });
  }
};


}

export default AuthController;
