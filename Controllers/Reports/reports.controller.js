import { ReportsModel } from "../../Schema/reports.schema.js";
import { User } from "../../Schema/user.schema.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";

class ReportsController {
  // Fetch all reports for a user's vehicles
  async getUserVehicleReports(req, res) {
    try {
      const userId =  req.user.id ;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized: Missing user." });
      }
      // Fetch the user document, then fetch the vehicles from the user's Myvehicle field
      const user = await User.findById(userId).select('myVehicles');
      let vehicleIds = user.myVehicles;
    
      // Fetch reports for these vehicles, populate vehicle and autoShop
      const reports = await ReportsModel.find({ vehicleId: { $in: vehicleIds } })
        .populate({ path: "vehicleId", select: "licensePlateNo make model year vinNo" })
        .populate({ path: "autoShopId", select: "name phone address" })
        .sort({ date: -1 });

      res.json({ reports });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reports.", details: error.message });
    }
  }
}

export default ReportsController;
