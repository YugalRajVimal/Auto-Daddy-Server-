import Services from "../../Schema/services.schema.js";


class AdminController {



// Add a new service (with optional subservices)
async addService(req, res) {
  try {
    const { name, desc, services } = req.body;
    const newService = new Services({ name, desc, services: services || [] });
    await newService.save();
    res.status(201).json({ success: true, message: "Service added successfully", data: newService });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding service", error: err.message });
  }
}


// Edit a service by ID
async editService(req, res) {
    try {
      const { id } = req.params;
      const { name, desc, services } = req.body;
      const updatedService = await Services.findByIdAndUpdate(
        id,
        { name, desc, services },
        { new: true }
      );
      if (!updatedService) {
        return res.status(404).json({ success: false, message: "Service not found" });
      }
      res.status(200).json({ success: true, message: "Service updated", data: updatedService });
    } catch (err) {
      res.status(500).json({ success: false, message: "Error editing service", error: err.message });
    }
  }

// Fetch all services
async fetchServices(req, res) {
  try {
    const allServices = await Services.find({});
    res.status(200).json({ success: true, data: allServices });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching services", error: err.message });
  }
}


// Delete a service by ID
async deleteService(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Services.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    res.status(200).json({ success: true, message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error deleting service", error: err.message });
  }
}



}

export default AdminController;

