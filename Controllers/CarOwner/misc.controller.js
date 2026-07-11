import DashboardDataModel from "../../Schema/dashboardData.schema.js";
import { User } from "../../Schema/user.schema.js";
import canadianMunicipalities from "../cityData.js";
import Province from "../../Schema/cities.schema.js";


/**
 * MiscController
 * Handles: cities lookup, Thought of the Day like toggle
 */
class MiscController {

    
    /**
     * Fetch cities from the Province collection.
     * Supports:
     *   - search: case-insensitive search on city name (returns all matching cities across provinces)
     *   - pagination: results paged across all cities (default pageSize 100)
     *   - Returns city name, province, country, province status, city status
     */
    async fetchCities(req, res) {
        try {
            const search = req.query.search?.trim();
            const page = parseInt(req.query.page, 10) > 0 ? parseInt(req.query.page, 10) : 1;
            const pageSize = 100;

            // Build aggregation pipeline for flexible querying
            const pipeline = [];

            // Unwind cities array so each city is a document
            pipeline.push({ $unwind: "$cities" });

            // Optional: Only "Active" provinces/cities if needed (remove if not required)
            // pipeline.push({ $match: { status: "Active", "cities.status": "Active" } });

            // Search filtering
            if (search) {
                pipeline.push({
                    $match: {
                        "cities.name": { $regex: search, $options: "i" },
                    }
                });
            }

            // Project required fields
            pipeline.push({
                $project: {
                    _id: 0,
                    name: "$cities.name",
                    status: "$cities.status",
                    province: "$name",
                    provinceStatus: "$status",
                    country: "$country"
                }
            });

            // Count total (for pagination: only relevant if no search, but let's provide both)
            const countPipeline = [...pipeline, { $count: "total" }];
            const totalResult = await Province.aggregate(countPipeline);
            const total = totalResult[0]?.total || 0;
            const totalPages = Math.ceil(total / pageSize);

            // Paging
            pipeline.push({ $skip: (page - 1) * pageSize });
            pipeline.push({ $limit: pageSize });

            // Do actual query
            const cities = await Province.aggregate(pipeline);

            return res.status(200).json({
                success: true,
                data: cities,
                ...(search
                    ? { total }
                    : {
                        page,
                        pageSize,
                        total,
                        totalPages,
                    }
                )
            });
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
