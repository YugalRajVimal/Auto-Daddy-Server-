import InvoiceCounter from "../../Schema/Invoicecounter.schema.js";
import InvoicePrefix, { getInvoicePrefixForYear, setInvoicePrefix } from "../../Schema/invoiceprefix.schema.js";
import { User } from "../../Schema/user.schema.js";

/**
 * Helper function to fetch the user's associated businessProfile ID from the database,
 * given a userId. Returns null if not found.
 */
async function getBusinessId(userId) {
  const user = await User.findById(userId).select("businessProfile");
  return user?.businessProfile || null;
}

// Restricts allowed invoice prefix values: 1-10 alphanumeric (A-Z, 0-9 only).
const PREFIX_REGEX = /^[A-Z0-9]{1,10}$/i;

/**
 * PUT /invoice-prefix
 * Sets or updates the invoice prefix for a given year for the caller's business.
 * Expects req.body: { prefix: "ABC", year?: 2026 }
 * If year omitted, defaults to the current calendar year. Value is validated and normalized.
 */
export const setInvoicePrefixController = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({
        success: false,
        message: "Business profile not found"
      });
    }

    let { prefix, year } = req.body;

    if (!prefix || typeof prefix !== "string" || !prefix.trim()) {
      return res.status(400).json({
        success: false,
        message: "prefix is required"
      });
    }

    prefix = prefix.trim();
    if (!PREFIX_REGEX.test(prefix)) {
      return res.status(400).json({
        success: false,
        message: "prefix must be 1-10 alphanumeric characters (A-Z, 0-9 only, no spaces or symbols)",
      });
    }

    let targetYear = new Date().getFullYear();
    if (year !== undefined) {
      targetYear = Number(year);
      if (
        !Number.isInteger(targetYear) ||
        targetYear < 2000 ||
        targetYear > 2100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid year"
        });
      }
    }

    // setInvoicePrefix also normalizes the prefix
    const doc = await setInvoicePrefix(businessId, prefix, targetYear);

    return res.status(200).json({
      success: true,
      message: `Invoice prefix for ${targetYear} set to "${doc.prefix}"`,
      data: { year: doc.year, prefix: doc.prefix }
    });
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to set invoice prefix",
      error: error.message
    });
  }
};

/**
 * GET /invoice-prefix?year=2026
 * Gets the invoice prefix for the business for the given year (or current year if omitted).
 */
export const getInvoicePrefixController = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({
        success: false,
        message: "Business profile not found"
      });
    }

    let targetYear = new Date().getFullYear();
    if (req.query.year !== undefined) {
      targetYear = Number(req.query.year);
      if (!Number.isInteger(targetYear)) {
        return res.status(400).json({
          success: false,
          message: "Invalid year"
        });
      }
    }

    const doc = await getInvoicePrefixForYear(businessId, targetYear);

    // Fetch the invoice counter current number for the prefix/year as well.
    let invoiceCounter = null;
    if (doc) {    
      // Assuming you have a model named InvoiceCounter with business, year, and current fields
      // IMPORTANT: You may need to adjust this code to fit your model/schema names!
      const counterDoc = await InvoiceCounter.findOne({
        business: businessId
      });

      console.log(counterDoc)

      invoiceCounter = counterDoc ? counterDoc.seq : null;
    }


    return res.status(200).json({
      success: true,
      data: doc
        ? { year: doc.year, prefix: doc.prefix, invoiceCounter }
        : { year: targetYear, prefix: null, invoiceCounter: null }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice prefix",
      error: error.message
    });
  }
};

/**
 * GET /invoice-prefix/all
 * Returns all known invoice prefix settings (history) for this business, sorted newest year first.
 */
export const getAllInvoicePrefixesController = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({
        success: false,
        message: "Business profile not found"
      });
    }

    const docs = await InvoicePrefix.find({ business: businessId }).sort({ year: -1 });

    return res.status(200).json({
      success: true,
      data: docs.map((d) => ({ year: d.year, prefix: d.prefix }))
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice prefix history",
      error: error.message
    });
  }
};