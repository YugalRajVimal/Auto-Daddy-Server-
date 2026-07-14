import mongoose from "mongoose";
import Domain from "../../Schema/domain.schema.js";
import { User } from "../../Schema/user.schema.js"; // adjust path to your User model

const USER_TYPES = ["carowner", "autoshopowner"];
const DOMAIN_TYPES = ["existing", "new"];

function isValidDate(value) {
  return !isNaN(new Date(value).getTime());
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Verify that userId exists in Users collection and its role matches userType
 */
async function verifyUserRef(userId, userType) {
  if (!isValidObjectId(userId)) {
    return { valid: false, message: "Invalid userId." };
  }
  const user = await User.findById(userId);
  if (!user) {
    return { valid: false, message: "Referenced user not found." };
  }
  if (user.role !== userType) {
    return { valid: false, message: `User's role (${user.role}) does not match userType (${userType}).` };
  }
  return { valid: true };
}

/**
 * Add a new domain record
 * POST /admin/domains
 * Body: { userType, userId, domain, domainType, expiry, provider, dns }
 */
export const addDomain = async (req, res) => {
  try {
    const { userType, userId, domain, domainType, expiry, provider, dns } = req.body;

    if (!userType || !userId || !domain || !domainType || !expiry || !provider || !dns) {
      return res.status(400).json({
        success: false,
        message: "userType, userId, domain, domainType, expiry, provider and dns are required.",
      });
    }

    if (!USER_TYPES.includes(userType)) {
      return res.status(400).json({
        success: false,
        message: `userType must be one of: ${USER_TYPES.join(", ")}.`,
      });
    }

    if (!DOMAIN_TYPES.includes(domainType)) {
      return res.status(400).json({
        success: false,
        message: `domainType must be one of: ${DOMAIN_TYPES.join(", ")}.`,
      });
    }

    if (!isValidDate(expiry)) {
      return res.status(400).json({ success: false, message: "Invalid expiry date." });
    }

    const userCheck = await verifyUserRef(userId, userType);
    if (!userCheck.valid) {
      return res.status(400).json({ success: false, message: userCheck.message });
    }

    const newDomain = new Domain({
      userType,
      userId,
      domain: domain.trim(),
      domainType,
      expiry: new Date(expiry),
      provider: provider.trim(),
      dns: dns.trim(),
    });

    await newDomain.save();

    return res.status(201).json({ success: true, data: newDomain });
  } catch (err) {
    console.error("[addDomain] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to add domain", error: err.message });
  }
};

/**
 * Edit a domain record by ID
 * PATCH /admin/domains/:id
 */
export const editDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const { userType, userId, domain, domainType, expiry, provider, dns } = req.body;

    if (!userType && !userId && !domain && !domainType && !expiry && !provider && !dns) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    if (userType && !USER_TYPES.includes(userType)) {
      return res.status(400).json({
        success: false,
        message: `userType must be one of: ${USER_TYPES.join(", ")}.`,
      });
    }

    if (domainType && !DOMAIN_TYPES.includes(domainType)) {
      return res.status(400).json({
        success: false,
        message: `domainType must be one of: ${DOMAIN_TYPES.join(", ")}.`,
      });
    }

    if (expiry && !isValidDate(expiry)) {
      return res.status(400).json({ success: false, message: "Invalid expiry date." });
    }

    // If either userType or userId is changing, re-validate the ref against the resulting pair
    if (userType || userId) {
      const existing = await Domain.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Domain not found." });
      }
      const effectiveUserType = userType || existing.userType;
      const effectiveUserId = userId || existing.userId;

      const userCheck = await verifyUserRef(effectiveUserId, effectiveUserType);
      if (!userCheck.valid) {
        return res.status(400).json({ success: false, message: userCheck.message });
      }
    }

    const updateFields = {};
    if (userType) updateFields.userType = userType;
    if (userId) updateFields.userId = userId;
    if (domain) updateFields.domain = domain.trim();
    if (domainType) updateFields.domainType = domainType;
    if (expiry) updateFields.expiry = new Date(expiry);
    if (provider) updateFields.provider = provider.trim();
    if (dns) updateFields.dns = dns.trim();

    const updated = await Domain.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Domain not found." });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[editDomain] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to edit domain", error: err.message });
  }
};

/**
 * Fetch all domains, with filter and search on User Type, User Name, Domain, Domain Type, Expiry, Provider, DNS
 * GET /admin/domains?userType=autoshopowner&userName=...&domain=...&domainType=new&expiry=YYYY-MM-DD&provider=GoDaddy&dns=ns1&expiringBefore=2026-12-31
 */
export const getDomains = async (req, res) => {
  try {
    const { userType, userName, domain, domainType, expiry, provider, dns, userId, expiringBefore } = req.query;
    const filter = {};

    // Field: User Type
    if (userType) filter.userType = userType;

    // Field: Domain Name (search, partial match)
    if (domain) filter.domain = { $regex: domain, $options: "i" };

    // Field: Domain Type
    if (domainType) filter.domainType = domainType;

    // Field: Expiry (exact match, or use expiringBefore for range)
    if (expiry) {
      if (!isValidDate(expiry)) {
        return res.status(400).json({ success: false, message: "Invalid expiry date." });
      }
      filter.expiry = new Date(expiry);
    }
    // Field: Expiring before (range query)
    if (expiringBefore) {
      if (!isValidDate(expiringBefore)) {
        return res.status(400).json({ success: false, message: "Invalid expiringBefore date." });
      }
      // Merge with expiry field if also present
      filter.expiry = filter.expiry
        ? { ...filter.expiry, $lte: new Date(expiringBefore) }
        : { $lte: new Date(expiringBefore) };
    }
    // Field: Provider (search, partial match)
    if (provider) filter.provider = { $regex: provider, $options: "i" };

    // Field: DNS (search, partial match)
    if (dns) filter.dns = { $regex: dns, $options: "i" };

    // Field: userId
    if (userId) {
      if (!isValidObjectId(userId)) {
        return res.status(400).json({ success: false, message: "Invalid userId." });
      }
      filter.userId = userId;
    }

    // 1. Find domains matching main filters (excluding userName, which requires user population)
    let domains = await Domain.find(filter)
      .populate({ path: "userId", model: User, select: "name email phone role" })
      .sort({ createdAt: -1 });

    // 2. Filter by User Name (if provided)
    if (userName) {
      const searchVal = String(userName).toLowerCase();
      domains = domains.filter(d =>
        d.userId &&
        d.userId.name &&
        d.userId.name.toLowerCase().includes(searchVal)
      );
    }

    return res.status(200).json({ success: true, data: domains });
  } catch (err) {
    console.error("[getDomains] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch domains", error: err.message });
  }
};

/**
 * Fetch single domain by ID
 * GET /admin/domains/:id
 */
export const getDomainById = async (req, res) => {
  try {
    const domain = await Domain.findById(req.params.id).populate("userId", "name email phone role");
    if (!domain) {
      return res.status(404).json({ success: false, message: "Domain not found." });
    }
    return res.status(200).json({ success: true, data: domain });
  } catch (err) {
    console.error("[getDomainById] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch domain", error: err.message });
  }
};

/**
 * Delete a domain record
 * DELETE /admin/domains/:id
 */
export const deleteDomain = async (req, res) => {
  try {
    const deleted = await Domain.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Domain not found." });
    }
    return res.status(200).json({ success: true, message: "Domain deleted." });
  } catch (err) {
    console.error("[deleteDomain] Error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete domain", error: err.message });
  }
};