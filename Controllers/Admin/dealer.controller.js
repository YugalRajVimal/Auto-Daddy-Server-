import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import Dealer from "../../Schema/dealers.schema.js";

class DealerController {

  /**
   * Add a new dealer, with optional dealerImage upload
   * POST /admin/dealer
   * Body: { name, email, phone, dealership, city, address?, websiteUrl?, status? }
   * File: dealerImage (optional image upload via multipart/form-data)
   */
  async addDealer(req, res) {
    let imagePath = null;
    try {
      const { name, email, phone, dealership, city, address, websiteUrl, status } = req.body;

      if (!name || !email || !phone || !dealership || !city) {
        if (req.files?.dealerImage?.[0]) deleteUploadedFile(req.files.dealerImage[0]);
        return res.status(400).json({
          message: "name, email, phone, dealership and city are required."
        });
      }

      if (req.files && req.files.dealerImage && req.files.dealerImage[0]) {
        imagePath = req.files.dealerImage[0].path;
      }

      // Check for duplicate email
      const existing = await Dealer.findOne({ email });
      if (existing) {
        if (imagePath) deleteUploadedFile(imagePath);
        return res.status(409).json({ message: "Dealer with this email already exists." });
      }

      const newDealer = new Dealer({
        name,
        email,
        phone,
        dealership,
        city,
        address: address || undefined,
        websiteUrl: websiteUrl || undefined,
        image: imagePath || null,
        status: status || "Active"
      });

      await newDealer.save();

      return res.status(201).json({ success: true, data: newDealer });

    } catch (err) {
      if (imagePath) deleteUploadedFile(imagePath);
      console.error("[addDealer] Error:", err);
      return res.status(500).json({ message: "Failed to add dealer", error: err.message });
    }
  }

  /**
   * Edit a dealer by ID, including optional update of image
   * PATCH /admin/dealer/:id
   * Body may include any subset of dealer fields
   * File: dealerImage (optional, replaces old if provided)
   */
  async editDealer(req, res) {
    let imagePath = null;
    try {
      const { id } = req.params;
      const { name, email, phone, dealership, city, address, websiteUrl, status, listings, leads } = req.body;

      const hasTextUpdate = name || email || phone || dealership || city ||
        address || websiteUrl || status || listings !== undefined || leads !== undefined;

      if (!hasTextUpdate && !req.files?.dealerImage) {
        if (req.files?.dealerImage?.[0]) deleteUploadedFile(req.files.dealerImage[0]);
        return res.status(400).json({ message: "Nothing to update." });
      }

      const updateFields = {};
      if (name) updateFields.name = name;
      if (email) updateFields.email = email;
      if (phone) updateFields.phone = phone;
      if (dealership) updateFields.dealership = dealership;
      if (city) updateFields.city = city;
      if (address !== undefined) updateFields.address = address;
      if (websiteUrl) updateFields.websiteUrl = websiteUrl;
      if (status) updateFields.status = status;
      if (listings !== undefined) updateFields.listings = listings;
      if (leads !== undefined) updateFields.leads = leads;

      // If email is being changed, check for duplicates
      if (email) {
        const existing = await Dealer.findOne({ email, _id: { $ne: id } });
        if (existing) {
          if (req.files?.dealerImage?.[0]) deleteUploadedFile(req.files.dealerImage[0]);
          return res.status(409).json({ message: "Another dealer with this email already exists." });
        }
      }

      // New image uploaded
      if (req.files && req.files.dealerImage && req.files.dealerImage[0]) {
        imagePath = req.files.dealerImage[0].path;
        updateFields.image = imagePath;
      }

      // Fetch previous dealer to clean up old image if replaced
      let prevDealer = null;
      if (imagePath) {
        prevDealer = await Dealer.findById(id);
      }

      const updated = await Dealer.findByIdAndUpdate(id, updateFields, { new: true });
      if (!updated) {
        if (imagePath) deleteUploadedFile(imagePath);
        return res.status(404).json({ message: "Dealer not found." });
      }

      // Delete old image if replaced by a new one
      if (imagePath && prevDealer && prevDealer.image && prevDealer.image !== imagePath) {
        deleteUploadedFile(prevDealer.image);
      }

      return res.status(200).json({ success: true, data: updated });
    } catch (err) {
      if (imagePath) deleteUploadedFile(imagePath);
      console.error("[editDealer] Error:", err);
      return res.status(500).json({ message: "Failed to edit dealer", error: err.message });
    }
  }

  /**
   * Fetch all dealers, or filter by name/city/status if query provided
   * GET /admin/dealer?name=John&city=Delhi&status=Active
   */
  async fetchDealers(req, res) {
    try {
      const { name, city, status, email } = req.query;
      const filter = {};
      if (name) filter.name = { $regex: name, $options: "i" };
      if (city) filter.city = { $regex: city, $options: "i" };
      if (email) filter.email = { $regex: email, $options: "i" };
      if (status) filter.status = status;

      const dealers = await Dealer.find(filter).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: dealers });
    } catch (err) {
      console.error("[fetchDealers] Error:", err);
      return res.status(500).json({ message: "Failed to fetch dealers", error: err.message });
    }
  }

  /**
   * Fetch single dealer by ID
   * GET /admin/dealer/:id
   */
  async fetchDealerById(req, res) {
    try {
      const { id } = req.params;
      const dealer = await Dealer.findById(id);
      if (!dealer) {
        return res.status(404).json({ message: "Dealer not found." });
      }
      return res.status(200).json({ success: true, data: dealer });
    } catch (err) {
      console.error("[fetchDealerById] Error:", err);
      return res.status(500).json({ message: "Failed to fetch dealer", error: err.message });
    }
  }

  /**
   * Delete a dealer by ID (also deletes their uploaded image, if any)
   * DELETE /admin/dealer/:id
   */
  async deleteDealer(req, res) {
    try {
      const { id } = req.params;
      const dealer = await Dealer.findById(id);
      if (!dealer) {
        return res.status(404).json({ message: "Dealer not found." });
      }

      // Mark status as "Deleted"
      dealer.status = "Deleted";
      await dealer.save();

      // OPTIONAL: If you want to delete the image file when marking as deleted
      if (dealer.image) {
        deleteUploadedFile(dealer.image);
        // Optionally clear image path after deleting
        dealer.image = null;
        await dealer.save();
      }

      return res.status(200).json({ success: true, message: "Dealer marked as deleted." });
    } catch (err) {
      console.error("[deleteDealer] Error:", err);
      return res.status(500).json({ message: "Failed to delete dealer", error: err.message });
    }
  }
}

export default DealerController;