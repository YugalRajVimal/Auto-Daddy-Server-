import AutoShopModel from "../../Schema/auto-shops.schema.js";

class AutoShopController {


async getAllAutoShops(req, res) {
    try {
        const autoShops = await AutoShopModel.find({});
        res.status(200).json({ success: true, data: autoShops });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch auto shops', error: error.message });
    }
}




}

export default AutoShopController;
