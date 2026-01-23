import DiscountModel from "../../Schema/discount.schema.js";

class DiscountController {


  /**
   * Fetch all discounts from the database.
   * Returns an array of all discount documents.
   */
  async fetchAllDisocunts(req, res) {
    try {

      const discounts = await DiscountModel.find({ discountEnabled: true });
      res.status(200).json({ success: true, data: discounts });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error fetching discounts", error: error.message });
    }
  }




}

export default DiscountController;
