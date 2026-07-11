import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import { User } from "../../Schema/user.schema.js";
import canadianMunicipalities from "../cityData.js";

/**
 * MiscController
 * Handles: cities lookup, Thought of the Day like toggle
 */
class MiscController {

    async fetchCities(req, res) {
        try {
            const search = req.query.search?.trim();
            if (search) {
                // Case-insensitive substring search
                const searchLower = search.toLowerCase();
                const matches = canadianMunicipalities.filter(city =>
                    city.toLowerCase().includes(searchLower)
                );

                // You can optionally paginate matches as well, but requirement is just to return matches
                return res.status(200).json({
                    success: true,
                    data: matches
                });
            } else {
                // Pagination: page, pageSize = 100
                const page = parseInt(req.query.page, 10) > 0 ? parseInt(req.query.page, 10) : 1;
                const pageSize = 100;
                const startIdx = (page - 1) * pageSize;
                const endIdx = startIdx + pageSize;
                const pageResults = canadianMunicipalities.slice(startIdx, endIdx);

                return res.status(200).json({
                    success: true,
                    page,
                    pageSize,
                    total: canadianMunicipalities.length,
                    totalPages: Math.ceil(canadianMunicipalities.length / pageSize),
                    data: pageResults
                });
            }
        } catch (err) {
            console.error("[fetchCities] Error:", err);
            res.status(500).json({ success: false, message: "Failed to fetch cities", error: err.message });
        }
    }

    /**
     * Toggle the user's liked state for Thought of the Day.
     * If liked, unlikes it and decrements ThoughtOfTheDayLike in DashboardData.
     * If not liked, likes it and increments ThoughtOfTheDayLike.
     * Returns: { thoughtOfTheDayLiked: Boolean }
     */
    async toggleThoughtOfTheDayLiked(req, res) {
        try {
            const userId = req.user.id;

            // Get current user
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found." });
            }

            // There should only be one dashboardData doc
            let dashboardData = await DashboardDataModel.findOne();
            if (!dashboardData) {
                // Create default record if not present
                dashboardData = await DashboardDataModel.create({});
            }

            // Determine increment
            let increment = 0;
            if (user.thoughtOfTheDayLiked) {
                // If already liked, unlike (decrement like count, but not below 0)
                increment = -1;
                user.thoughtOfTheDayLiked = false;
                dashboardData.thoughtOfTheDayLike = Math.max(0, dashboardData.thoughtOfTheDayLike - 1);
            } else {
                // If not liked, like (increment like count)
                increment = 1;
                user.thoughtOfTheDayLiked = true;
                dashboardData.thoughtOfTheDayLike += 1;
            }

            await user.save();
            await dashboardData.save();

            return res.status(200).json({
                success: true,
                thoughtOfTheDayLiked: user.thoughtOfTheDayLiked,
                thoughtOfTheDayLike: dashboardData.thoughtOfTheDayLike
            });
        } catch (error) {
            console.error("toggleThoughtOfTheDayLiked error:", error);
            return res.status(500).json({ success: false, message: "Failed to toggle like", error: error.message });
        }
    }
}

export default MiscController;
