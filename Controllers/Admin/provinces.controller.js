
// import Province from "../../Schema/cities.schema.js";



// class ProvincesController {






// // =================== Province CRUD ===================

// // @route   POST /admin/provinces
// // @desc    Create a new province
// // @access  Admin
// async addProvince(req, res) {
//     try {
//         const { name, nickName = "", status = "Active" } = req.body;
//         if (!name) {
//             console.log("[addProvince] Province name missing in request body");
//             return res.status(400).json({ success: false, message: "Province name is required" });
//         }

//         // Check if province with same name exists (case-insensitive)
//         const existing = await Province.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
//         if (existing) {
//             console.log(`[addProvince] Province with name "${name}" already exists`);
//             return res.status(409).json({ success: false, message: "Province already exists" });
//         }

//         const province = new Province({ name, nickName, status, cities: [] });
//         await province.save();
//         console.log(`[addProvince] Province "${name}" created successfully`);
//         return res.status(201).json({ success: true, data: province });
//     } catch (err) {
//         console.log("[addProvince] Error:", err);
//         return res.status(500).json({ success: false, message: "Failed to add province", error: err.message });
//     }
// }

// // @route   GET /admin/provinces
// // @desc    Get list of all provinces (with cities)
// // @access  Admin
// async fetchProvinces(req, res) {
//     try {
//         const provinces = await Province.find({}).sort({ name: 1 });
//         console.log(`[fetchProvinces] Fetched ${provinces.length} provinces`);
//         return res.status(200).json({ success: true, data: provinces });
//     } catch (err) {
//         console.log("[fetchProvinces] Error:", err);
//         return res.status(500).json({ success: false, message: "Failed to fetch provinces", error: err.message });
//     }
// }

// // @route   PATCH /admin/provinces/:provinceId
// // @desc    Edit a province (name, nickName, status) by ID
// // @access  Admin
// async editProvince(req, res) {
//     try {
//         const { provinceId } = req.params;
//         const { name, nickName, status } = req.body;
//         if (!name) {
//             console.log("[editProvince] Province name missing in request body");
//             return res.status(400).json({ success: false, message: "Province name is required" });
//         }
//         // Check for another province with this name
//         const duplicate = await Province.findOne({ 
//             name: { $regex: `^${name}$`, $options: "i" },
//             _id: { $ne: provinceId }
//         });
//         if (duplicate) {
//             console.log(`[editProvince] Duplicate province name "${name}" found under different ID`);
//             return res.status(409).json({ success: false, message: "Another province with this name already exists" });
//         }
//         const updateFields = { name };
//         if (typeof nickName === "string") updateFields.nickName = nickName;
//         if (status && ['Active', 'Inactive'].includes(status)) updateFields.status = status;
//         const province = await Province.findByIdAndUpdate(provinceId, updateFields, { new: true });
//         if (!province) {
//             console.log(`[editProvince] Province with ID ${provinceId} not found`);
//             return res.status(404).json({ success: false, message: "Province not found" });
//         }
//         console.log(`[editProvince] Province "${provinceId}" updated`);
//         return res.status(200).json({ success: true, data: province });
//     } catch (err) {
//         console.log("[editProvince] Error:", err);
//         return res.status(500).json({ success: false, message: "Failed to edit province", error: err.message });
//     }
// }

// // @route   DELETE /admin/provinces/:provinceId
// // @desc    Delete a province by ID
// // @access  Admin
// async deleteProvince(req, res) {
//     try {
//         const { provinceId } = req.params;
//         const province = await Province.findByIdAndDelete(provinceId);
//         if (!province) {
//             console.log(`[deleteProvince] Province with ID ${provinceId} not found`);
//             return res.status(404).json({ success: false, message: "Province not found" });
//         }
//         console.log(`[deleteProvince] Province with ID ${provinceId} deleted`);
//         return res.status(200).json({ success: true, message: "Province deleted successfully" });
//     } catch (err) {
//         console.log("[deleteProvince] Error:", err);
//         return res.status(500).json({ success: false, message: "Failed to delete province", error: err.message });
//     }
// }

// // =================== Cities within Province ===================

// // @route   POST /admin/provinces/:provinceId/cities
// // @desc    Add city to province
// // @access  Admin
// async addCity(req, res) {
//     try {
//         const { provinceId } = req.params;
//         const { name, status = "Active" } = req.body;
//         if (!name) {
//             console.log("[addCity] City name missing in request body");
//             return res.status(400).json({ success: false, message: "City name is required" });
//         }
//         if (status && !["Active", "Inactive"].includes(status)) {
//             console.log("[addCity] Invalid status for city");
//             return res.status(400).json({ success: false, message: "Invalid status for city" });
//         }
//         const province = await Province.findById(provinceId);
//         if (!province) {
//             console.log(`[addCity] Province with ID ${provinceId} not found`);
//             return res.status(404).json({ success: false, message: "Province not found" });
//         }
//         // Check for duplicate city in province (case-insensitive)
//         const duplicate = province.cities.find(
//             c => c.name.trim().toLowerCase() === name.trim().toLowerCase()
//         );
//         if (duplicate) {
//             console.log(`[addCity] City "${name}" already exists in province "${provinceId}"`);
//             return res.status(409).json({ success: false, message: "City already exists in this province" });
//         }
//         province.cities.push({ name: name.trim(), status });
//         await province.save();
//         console.log(`[addCity] City "${name}" added to province "${provinceId}"`);
//         return res.status(201).json({ success: true, data: province.cities });
//     } catch (err) {
//         console.log("[addCity] Error:", err);
//         return res.status(500).json({ success: false, message: "Failed to add city", error: err.message });
//     }
// }

// // @route   PATCH /admin/provinces/:provinceId/cities/:cityName
// // @desc    Edit a city (name, status) by city name (case-insensitive) in province
// // @access  Admin
// async editCity(req, res) {
//     try {
//         const { provinceId, cityName } = req.params;
//         const { name, status } = req.body;
//         if (!name && !status) {
//             console.log("[editCity] City name/status missing in request body");
//             return res.status(400).json({ success: false, message: "City name or status is required" });
//         }
//         if (status && !["Active", "Inactive"].includes(status)) {
//             console.log("[editCity] Invalid status for city");
//             return res.status(400).json({ success: false, message: "Invalid status for city" });
//         }
//         const province = await Province.findById(provinceId);
//         if (!province) {
//             console.log(`[editCity] Province with ID ${provinceId} not found`);
//             return res.status(404).json({ success: false, message: "Province not found" });
//         }
//         // Ensure no duplicate city name with new value (if a new name is provided)
//         if (name) {
//             const duplicate = province.cities.find(
//                 city => city.name.trim().toLowerCase() === name.trim().toLowerCase()
//             );
//             // Only treat as duplicate if the duplicate is NOT the current city we're editing
//             if (duplicate && cityName.trim().toLowerCase() !== name.trim().toLowerCase()) {
//                 console.log(`[editCity] Another city with name "${name}" exists in province "${provinceId}"`);
//                 return res.status(409).json({ success: false, message: "Another city with this name already exists in this province" });
//             }
//         }
//         // Find the city to update
//         let updated = false;
//         for (let city of province.cities) {
//             if (city.name.trim().toLowerCase() === cityName.trim().toLowerCase()) {
//                 if (name) city.name = name.trim();
//                 if (status) city.status = status;
//                 updated = true;
//                 break;
//             }
//         }
//         if (!updated) {
//             console.log(`[editCity] City "${cityName}" not found in province "${provinceId}"`);
//             return res.status(404).json({ success: false, message: "City not found in this province" });
//         }
//         await province.save();
//         console.log(`[editCity] City "${cityName}" edited in province "${provinceId}"`);
//         return res.status(200).json({ success: true, data: province.cities });
//     } catch (err) {
//         console.log("[editCity] Error:", err);
//         return res.status(500).json({ success: false, message: "Failed to edit city", error: err.message });
//     }
// }

// // @route   DELETE /admin/provinces/:provinceId/cities/:cityName
// // @desc    Delete a city by name from province (case-insensitive)
// // @access  Admin
// async deleteCity(req, res) {
//     try {
//         const { provinceId, cityName } = req.params;
//         const province = await Province.findById(provinceId);
//         if (!province) {
//             console.log(`[deleteCity] Province with ID ${provinceId} not found`);
//             return res.status(404).json({ success: false, message: "Province not found" });
//         }
//         const initialLength = province.cities.length;
//         province.cities = province.cities.filter(
//             city => city.name.trim().toLowerCase() !== cityName.trim().toLowerCase()
//         );
//         if (province.cities.length === initialLength) {
//             console.log(`[deleteCity] City "${cityName}" not found in province "${provinceId}"`);
//             return res.status(404).json({ success: false, message: "City not found in this province" });
//         }
//         await province.save();
//         console.log(`[deleteCity] City "${cityName}" deleted from province "${provinceId}"`);
//         return res.status(200).json({ success: true, message: "City deleted successfully", data: province.cities });
//     } catch (err) {
//         console.log("[deleteCity] Error:", err);
//         return res.status(500).json({ success: false, message: "Failed to delete city", error: err.message });
//     }
// }
// }

// export default ProvincesController;


import Province from "../../Schema/cities.schema.js";

class ProvincesController {

// =================== Province CRUD ===================

// @route   POST /admin/provinces
// @desc    Create a new province
// @access  Admin
async addProvince(req, res) {
    try {
        const { name, country, nickName = "", status = "Active" } = req.body;
        if (!name) {
            console.log("[addProvince] Province name missing in request body");
            return res.status(400).json({ success: false, message: "Province name is required" });
        }
        if (!country) {
            console.log("[addProvince] Country missing in request body");
            return res.status(400).json({ success: false, message: "Country is required" });
        }

        // Check if province with same name exists within the same country
        // (case-insensitive on both fields).
        const existing = await Province.findOne({
            name: { $regex: `^${name.trim()}$`, $options: "i" },
            country: { $regex: `^${country.trim()}$`, $options: "i" }
        });
        if (existing) {
            console.log(`[addProvince] Province "${name}" already exists in country "${country}"`);
            return res.status(409).json({ success: false, message: "Province already exists in this country" });
        }

        const province = new Province({
            name: name.trim(),
            country: country.trim(),
            nickName,
            status,
            cities: []
        });
        await province.save();
        console.log(`[addProvince] Province "${name}" created successfully in "${country}"`);
        return res.status(201).json({ success: true, data: province });
    } catch (err) {
        // Covers the rare race where two requests pass the findOne check at
        // the same time — the unique(name, country) index rejects the second
        // insert at the DB layer (Mongo duplicate key error, code 11000).
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: "Province already exists in this country" });
        }
        console.log("[addProvince] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to add province", error: err.message });
    }
}

// @route   GET /admin/provinces
// @desc    Get list of all provinces (with cities)
// @access  Admin
// Supports optional ?country= filter since province names are no longer
// globally unique — the frontend will likely want to scope by country.
async fetchProvinces(req, res) {
    try {
        const { country } = req.query;
        const filter = {};
        if (country) {
            filter.country = { $regex: `^${country.trim()}$`, $options: "i" };
        }
        const provinces = await Province.find(filter).sort({ country: 1, name: 1 });
        console.log(`[fetchProvinces] Fetched ${provinces.length} provinces`);
        return res.status(200).json({ success: true, data: provinces });
    } catch (err) {
        console.log("[fetchProvinces] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch provinces", error: err.message });
    }
}

// @route   PATCH /admin/provinces/:provinceId
// @desc    Edit a province (name, country, nickName, status) by ID
// @access  Admin
async editProvince(req, res) {
    try {
        const { provinceId } = req.params;
        const { name, country, nickName, status } = req.body;
        if (!name) {
            console.log("[editProvince] Province name missing in request body");
            return res.status(400).json({ success: false, message: "Province name is required" });
        }
        if (!country) {
            console.log("[editProvince] Country missing in request body");
            return res.status(400).json({ success: false, message: "Country is required" });
        }

        // Check for another province with this name in the same country
        const duplicate = await Province.findOne({
            name: { $regex: `^${name.trim()}$`, $options: "i" },
            country: { $regex: `^${country.trim()}$`, $options: "i" },
            _id: { $ne: provinceId }
        });
        if (duplicate) {
            console.log(`[editProvince] Duplicate province "${name}" in country "${country}" found under different ID`);
            return res.status(409).json({ success: false, message: "Another province with this name already exists in this country" });
        }

        const updateFields = { name: name.trim(), country: country.trim() };
        if (typeof nickName === "string") updateFields.nickName = nickName;
        if (status && ['Active', 'Inactive'].includes(status)) updateFields.status = status;

        const province = await Province.findByIdAndUpdate(provinceId, updateFields, { new: true });
        if (!province) {
            console.log(`[editProvince] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        console.log(`[editProvince] Province "${provinceId}" updated`);
        return res.status(200).json({ success: true, data: province });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: "Another province with this name already exists in this country" });
        }
        console.log("[editProvince] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to edit province", error: err.message });
    }
}

// @route   DELETE /admin/provinces/:provinceId
// @desc    Delete a province by ID
// @access  Admin
async deleteProvince(req, res) {
    try {
        const { provinceId } = req.params;
        const province = await Province.findByIdAndDelete(provinceId);
        if (!province) {
            console.log(`[deleteProvince] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        console.log(`[deleteProvince] Province with ID ${provinceId} deleted`);
        return res.status(200).json({ success: true, message: "Province deleted successfully" });
    } catch (err) {
        console.log("[deleteProvince] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete province", error: err.message });
    }
}

// =================== Cities within Province ===================

// @route   POST /admin/provinces/:provinceId/cities
// @desc    Add city to province
// @access  Admin
async addCity(req, res) {
    try {
        const { provinceId } = req.params;
        const { name, status = "Active" } = req.body;
        if (!name) {
            console.log("[addCity] City name missing in request body");
            return res.status(400).json({ success: false, message: "City name is required" });
        }
        if (status && !["Active", "Inactive"].includes(status)) {
            console.log("[addCity] Invalid status for city");
            return res.status(400).json({ success: false, message: "Invalid status for city" });
        }
        const province = await Province.findById(provinceId);
        if (!province) {
            console.log(`[addCity] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        // Check for duplicate city in province (case-insensitive)
        const duplicate = province.cities.find(
            c => c.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (duplicate) {
            console.log(`[addCity] City "${name}" already exists in province "${provinceId}"`);
            return res.status(409).json({ success: false, message: "City already exists in this province" });
        }
        province.cities.push({ name: name.trim(), status });
        await province.save();
        console.log(`[addCity] City "${name}" added to province "${provinceId}"`);
        return res.status(201).json({ success: true, data: province.cities });
    } catch (err) {
        console.log("[addCity] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to add city", error: err.message });
    }
}

// @route   PATCH /admin/provinces/:provinceId/cities/:cityName
// @desc    Edit a city (name, status) by city name (case-insensitive) in province
// @access  Admin
async editCity(req, res) {
    try {
        const { provinceId, cityName } = req.params;
        const { name, status } = req.body;
        if (!name && !status) {
            console.log("[editCity] City name/status missing in request body");
            return res.status(400).json({ success: false, message: "City name or status is required" });
        }
        if (status && !["Active", "Inactive"].includes(status)) {
            console.log("[editCity] Invalid status for city");
            return res.status(400).json({ success: false, message: "Invalid status for city" });
        }
        const province = await Province.findById(provinceId);
        if (!province) {
            console.log(`[editCity] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        // Ensure no duplicate city name with new value (if a new name is provided)
        if (name) {
            const duplicate = province.cities.find(
                city => city.name.trim().toLowerCase() === name.trim().toLowerCase()
            );
            // Only treat as duplicate if the duplicate is NOT the current city we're editing
            if (duplicate && cityName.trim().toLowerCase() !== name.trim().toLowerCase()) {
                console.log(`[editCity] Another city with name "${name}" exists in province "${provinceId}"`);
                return res.status(409).json({ success: false, message: "Another city with this name already exists in this province" });
            }
        }
        // Find the city to update
        let updated = false;
        for (let city of province.cities) {
            if (city.name.trim().toLowerCase() === cityName.trim().toLowerCase()) {
                if (name) city.name = name.trim();
                if (status) city.status = status;
                updated = true;
                break;
            }
        }
        if (!updated) {
            console.log(`[editCity] City "${cityName}" not found in province "${provinceId}"`);
            return res.status(404).json({ success: false, message: "City not found in this province" });
        }
        await province.save();
        console.log(`[editCity] City "${cityName}" edited in province "${provinceId}"`);
        return res.status(200).json({ success: true, data: province.cities });
    } catch (err) {
        console.log("[editCity] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to edit city", error: err.message });
    }
}

// @route   DELETE /admin/provinces/:provinceId/cities/:cityName
// @desc    Delete a city by name from province (case-insensitive)
// @access  Admin
async deleteCity(req, res) {
    try {
        const { provinceId, cityName } = req.params;
        const province = await Province.findById(provinceId);
        if (!province) {
            console.log(`[deleteCity] Province with ID ${provinceId} not found`);
            return res.status(404).json({ success: false, message: "Province not found" });
        }
        const initialLength = province.cities.length;
        province.cities = province.cities.filter(
            city => city.name.trim().toLowerCase() !== cityName.trim().toLowerCase()
        );
        if (province.cities.length === initialLength) {
            console.log(`[deleteCity] City "${cityName}" not found in province "${provinceId}"`);
            return res.status(404).json({ success: false, message: "City not found in this province" });
        }
        await province.save();
        console.log(`[deleteCity] City "${cityName}" deleted from province "${provinceId}"`);
        return res.status(200).json({ success: true, message: "City deleted successfully", data: province.cities });
    } catch (err) {
        console.log("[deleteCity] Error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete city", error: err.message });
    }
}
}

export default ProvincesController;