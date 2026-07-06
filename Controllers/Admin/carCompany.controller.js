
// import CarCompany from "../../Schema/car-company-schema.js";



// class CarCompanyController {


// // --- Car Company CRUD Operations ---


// /**
//  * Add a new car company with models and optional years, and optional brandLogo upload
//  * POST /admin/car-company
//  * Body: { companyName: string, models: [{ modelName: string, years?: [number] }] }
//  * File: brandLogo (optional image upload via multipart/form-data)
//  */
// async addCarCompany(req, res) {
//     let brandLogoPath = null;
//     try {
//         const { companyName, models } = req.body;

//         // If form-data, models may come as string
//         let parsedModels = models;
//         if (typeof models === "string") {
//             try {
//                 parsedModels = JSON.parse(models);
//             } catch {
//                 return res.status(400).json({ message: "models must be a valid JSON array." });
//             }
//         }

//         if (!companyName || !Array.isArray(parsedModels) || parsedModels.length === 0) {
//             // Delete uploaded image if relevant
//             if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
//             return res.status(400).json({ message: "companyName and models are required." });
//         }

//         // Ensure models elements at least have modelName, years optional
//         for (const model of parsedModels) {
//             if (!model.modelName) {
//                 if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
//                 return res.status(400).json({ message: "Each model must have a modelName." });
//             }
//             // years is OPTIONAL, no need to check for it
//         }

//         // brandLogo from req.files
//         if (req.files && req.files.brandLogo && req.files.brandLogo[0]) {
//             brandLogoPath = req.files.brandLogo[0].path;
//         }

//         // Check for duplicate companyName
//         const existing = await CarCompany.findOne({ companyName });
//         if (existing) {
//             if (brandLogoPath) deleteUploadedFile(brandLogoPath);
//             return res.status(409).json({ message: "Car company already exists." });
//         }

//         const newCompany = new CarCompany({
//             companyName,
//             models: parsedModels,
//             brandLogo: brandLogoPath || null
//         });

//         await newCompany.save();

//         return res.status(201).json({ success: true, data: newCompany });

//     } catch (err) {
//         // Clean up uploaded image on error
//         if (brandLogoPath) {
//             deleteUploadedFile(brandLogoPath);
//         }
//         console.error("[addCarCompany] Error:", err);
//         return res.status(500).json({ message: "Failed to add car company", error: err.message });
//     }
// }

// /**
//  * Edit a car company by ID, including optional update of brandLogo
//  * PATCH /admin/car-company/:id
//  * Body may include any subset of { companyName, models }
//  * File: brandLogo (optional, replaces old if provided)
//  */
// async editCarCompany(req, res) {
//     let brandLogoPath = null;
//     try {
//         const { id } = req.params;
//         const { companyName, models } = req.body;

//         // If form-data, models may come as string
//         let parsedModels = models;
//         if (typeof models === "string") {
//             try {
//                 parsedModels = JSON.parse(models);
//             } catch {
//                 if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
//                 return res.status(400).json({ message: "models must be a valid JSON array." });
//             }
//         }

//         if (!companyName && !parsedModels && !req.files?.brandLogo) {
//             if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
//             return res.status(400).json({ message: "Nothing to update." });
//         }

//         // If models provided, ensure each model has a modelName, years are optional
//         if (parsedModels) {
//             for (const model of parsedModels) {
//                 if (!model.modelName) {
//                     if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
//                     return res.status(400).json({ message: "Each model must have a modelName." });
//                 }
//                 // years is OPTIONAL, no need to check for it
//             }
//         }

//         const updateFields = {};
//         if (companyName) updateFields.companyName = companyName;
//         if (parsedModels) updateFields.models = parsedModels;

//         // brandLogo from req.files (new logo uploaded)
//         if (req.files && req.files.brandLogo && req.files.brandLogo[0]) {
//             brandLogoPath = req.files.brandLogo[0].path;
//             updateFields.brandLogo = brandLogoPath;
//         }

//         // Check for existing company and handle old logo delete if replacing with new
//         let prevCompany = null;
//         if (brandLogoPath) {
//             prevCompany = await CarCompany.findById(id);
//         }

//         const updated = await CarCompany.findByIdAndUpdate(id, updateFields, { new: true });
//         if (!updated) {
//             if (brandLogoPath) deleteUploadedFile(brandLogoPath);
//             return res.status(404).json({ message: "CarCompany not found." });
//         }

//         // Delete old logo if replaced by a new one
//         if (brandLogoPath && prevCompany && prevCompany.brandLogo && prevCompany.brandLogo !== brandLogoPath) {
//             deleteUploadedFile(prevCompany.brandLogo);
//         }

//         return res.status(200).json({ success: true, data: updated });
//     } catch (err) {
//         // Clean up uploaded image on error
//         if (brandLogoPath) {
//             deleteUploadedFile(brandLogoPath);
//         }
//         console.error("[editCarCompany] Error:", err);
//         return res.status(500).json({ message: "Failed to edit car company", error: err.message });
//     }
// }


// /**
//  * Fetch all car companies, or filter by companyName if query provided
//  * GET /admin/car-company?companyName=Honda
//  */
// async fetchCarCompanies(req, res) {
//     try {
//         const { companyName } = req.query;
//         let companies;
//         if (companyName) {
//             companies = await CarCompany.find({ companyName: { $regex: companyName, $options: "i" } });
//         } else {
//             companies = await CarCompany.find({});
//         }
//         return res.status(200).json({ success: true, data: companies });
//     } catch (err) {
//         console.error("[fetchCarCompanies] Error:", err);
//         return res.status(500).json({ message: "Failed to fetch car companies", error: err.message });
//     }
// }


// /**
//  * Delete a car company by ID
//  * DELETE /admin/car-company/:id
//  */
// async deleteCarCompany(req, res) {
//     try {
//         const { id } = req.params;
//         const deleted = await CarCompany.findByIdAndDelete(id);
//         if (!deleted) {
//             return res.status(404).json({ message: "CarCompany not found." });
//         }
//         return res.status(200).json({ success: true, message: "CarCompany deleted." });
//     } catch (err) {
//         console.error("[deleteCarCompany] Error:", err);
//         return res.status(500).json({ message: "Failed to delete car company", error: err.message });
//     }
// }
// }

// export default CarCompanyController;


import { deleteUploadedFile } from "../../middlewares/ImageUploadMiddlewares/fileDelete.middleware.js";
import CarCompany from "../../Schema/car-company-schema.js";


class CarCompanyController {


// --- Car Company CRUD Operations ---


/**
 * Add a new car company with models and country, and optional brandLogo upload
 * POST /admin/car-company
 * Body: { companyName: string, country: string, models: [{ modelName: string }] }
 * File: brandLogo (optional image upload via multipart/form-data)
 */
async addCarCompany(req, res) {
    let brandLogoPath = null;
    try {
        const { companyName, country, models } = req.body;

        // If form-data, models may come as string
        let parsedModels = models;
        if (typeof models === "string") {
            try {
                parsedModels = JSON.parse(models);
            } catch {
                return res.status(400).json({ message: "models must be a valid JSON array." });
            }
        }

        if (!companyName || !country || !Array.isArray(parsedModels) || parsedModels.length === 0) {
            // Delete uploaded image if relevant
            if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
            return res.status(400).json({ message: "companyName, country and models are required." });
        }

        // Ensure models elements at least have modelName
        for (const model of parsedModels) {
            if (!model.modelName) {
                if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
                return res.status(400).json({ message: "Each model must have a modelName." });
            }
        }

        // brandLogo from req.files
        if (req.files && req.files.brandLogo && req.files.brandLogo[0]) {
            brandLogoPath = req.files.brandLogo[0].path;
        }

        // Check for duplicate companyName
        const existing = await CarCompany.findOne({ companyName });
        if (existing) {
            if (brandLogoPath) deleteUploadedFile(brandLogoPath);
            return res.status(409).json({ message: "Car company already exists." });
        }

        const newCompany = new CarCompany({
            companyName,
            country,
            models: parsedModels,
            brandLogo: brandLogoPath || null
        });

        await newCompany.save();

        return res.status(201).json({ success: true, data: newCompany });

    } catch (err) {
        // Clean up uploaded image on error
        if (brandLogoPath) {
            deleteUploadedFile(brandLogoPath);
        }
        console.error("[addCarCompany] Error:", err);
        return res.status(500).json({ message: "Failed to add car company", error: err.message });
    }
}

/**
 * Edit a car company by ID, including optional update of brandLogo
 * PATCH /admin/car-company/:id
 * Body may include any subset of { companyName, country, models }
 * File: brandLogo (optional, replaces old if provided)
 */
async editCarCompany(req, res) {
    let brandLogoPath = null;
    try {
        const { id } = req.params;
        const { companyName, country, models } = req.body;

        // If form-data, models may come as string
        let parsedModels = models;
        if (typeof models === "string") {
            try {
                parsedModels = JSON.parse(models);
            } catch {
                if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
                return res.status(400).json({ message: "models must be a valid JSON array." });
            }
        }

        if (!companyName && !country && !parsedModels && !req.files?.brandLogo) {
            if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
            return res.status(400).json({ message: "Nothing to update." });
        }

        // If models provided, ensure each model has a modelName
        if (parsedModels) {
            for (const model of parsedModels) {
                if (!model.modelName) {
                    if (req.files?.brandLogo?.[0]) deleteUploadedFile(req.files.brandLogo[0]);
                    return res.status(400).json({ message: "Each model must have a modelName." });
                }
            }
        }

        const updateFields = {};
        if (companyName) updateFields.companyName = companyName;
        if (country) updateFields.country = country;
        if (parsedModels) updateFields.models = parsedModels;

        // brandLogo from req.files (new logo uploaded)
        if (req.files && req.files.brandLogo && req.files.brandLogo[0]) {
            brandLogoPath = req.files.brandLogo[0].path;
            updateFields.brandLogo = brandLogoPath;
        }

        // Check for existing company and handle old logo delete if replacing with new
        let prevCompany = null;
        if (brandLogoPath) {
            prevCompany = await CarCompany.findById(id);
        }

        const updated = await CarCompany.findByIdAndUpdate(id, updateFields, { new: true });
        if (!updated) {
            if (brandLogoPath) deleteUploadedFile(brandLogoPath);
            return res.status(404).json({ message: "CarCompany not found." });
        }

        // Delete old logo if replaced by a new one
        if (brandLogoPath && prevCompany && prevCompany.brandLogo && prevCompany.brandLogo !== brandLogoPath) {
            deleteUploadedFile(prevCompany.brandLogo);
        }

        return res.status(200).json({ success: true, data: updated });
    } catch (err) {
        // Clean up uploaded image on error
        if (brandLogoPath) {
            deleteUploadedFile(brandLogoPath);
        }
        console.error("[editCarCompany] Error:", err);
        return res.status(500).json({ message: "Failed to edit car company", error: err.message });
    }
}


/**
 * Fetch all car companies, or filter by companyName/country if query provided
 * GET /admin/car-company?companyName=Honda&country=Japan
 */
async fetchCarCompanies(req, res) {
    try {
        const { companyName, country } = req.query;
        const filter = {};
        if (companyName) filter.companyName = { $regex: companyName, $options: "i" };
        if (country) filter.country = { $regex: country, $options: "i" };

        const companies = await CarCompany.find(filter);
        return res.status(200).json({ success: true, data: companies });
    } catch (err) {
        console.error("[fetchCarCompanies] Error:", err);
        return res.status(500).json({ message: "Failed to fetch car companies", error: err.message });
    }
}


/**
 * Delete a car company by ID
 * DELETE /admin/car-company/:id
 */
async deleteCarCompany(req, res) {
    try {
        const { id } = req.params;
        const deleted = await CarCompany.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ message: "CarCompany not found." });
        }
        return res.status(200).json({ success: true, message: "CarCompany deleted." });
    } catch (err) {
        console.error("[deleteCarCompany] Error:", err);
        return res.status(500).json({ message: "Failed to delete car company", error: err.message });
    }
}
}

export default CarCompanyController;