import jwt from "jsonwebtoken";
import ExpiredTokenModel from "../../Schema/expired-token.schema.js";
import { User } from "../../Schema/user.schema.js";
import { Admin } from "../../Schema/admin.schema.js";

const jwtAuth = async (req, res, next) => {
  // Read the token from the Authorization header
  const token = req.headers["authorization"];

  // If no token is present, return an error
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check if token is in the expired tokens collection
  try {
    const existingExpiredToken = await ExpiredTokenModel.findOne({ token });
    if (existingExpiredToken) {
      // If tokenExpiry is set, enforce expiry time
      if (existingExpiredToken.tokenExpiry) {
        const now = new Date();
        if (now > existingExpiredToken.tokenExpiry) {
          return res.status(401).json({
            message: "Unauthorized: Token expired, please log in again.",
          });
        }
        // else (now <= tokenExpiry) -- allow through (token filled by mistake, ignore), or remove from db
      } else {
        // If no expiry attached, deny by default
        return res.status(401).json({
          message: "Unauthorized: Token expired, please log in again.",
        });
      }
    }
  } catch (err) {
    // In case of DB errors, fail secure
    return res.status(500).json({ error: "Internal Server Error" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload) {
      return res.status(401).json({ error: "Unauthorized Access" });
    }

    // Attach user info to req for downstream usage. Include role if present in payload.
    req.user = {
      id: payload.id,
      phone: payload.phone,
      role: payload.role, // included if token was generated for admin (see controller)
    };

    // If user is admin, find in Admin model, else in User model
    if (payload.role === "admin") {
      const dbAdmin = await Admin.findOne({
        _id: payload.id,
        role: "admin"
      });

      if (!dbAdmin) {
        return res
          .status(401)
          .json({ error: "Unauthorized: Admin not found in database." });
      }

      // If any admin status field for ban/suspend added in future, check here

      // Proceed to the next middleware or route handler
      return next();
    } else {
      // Default to User model
      const dbUser = await User.findOne({
        _id: payload.id,
      });

      if (!dbUser) {
        return res
          .status(401)
          .json({ error: "Unauthorized: User not found in database." });
      }

      if (["suspended", "deleted"].includes(dbUser.status)) {
        return res
          .status(403)
          .json({
            error: `User account is ${dbUser.status}. Please contact support.`,
          });
      }

      // Proceed to the next middleware or route handler
      return next();
    }
  } catch (error) {
    // If the token is not valid, return an error
    return res.status(401).json({ error: "Unauthorized Access" });
  }
};

export default jwtAuth;
