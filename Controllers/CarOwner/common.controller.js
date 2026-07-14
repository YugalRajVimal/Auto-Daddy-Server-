
import CommonModel from '../../Schema/common.schema.js';
import InviteHelpSchema from '../../Schema/InviteHelp.schema.js';
import { User } from '../../Schema/user.schema.js';

import mongoose from "mongoose";
import BusinessProfileModel from "../../Schema/bussiness-profile.js";
import { VehicleModel } from "../../Schema/vehicles.schema.js";
import JobCard from "../../Schema/jobCard.schema.js";
import DealModel from "../../Schema/deals.schema.js";
// ASSUMPTION: adjust these two import paths/names to match your actual files
import ServicesModel from "../../Schema/services.schema.js";


const { Types } = mongoose;

const normalizeToMidnight = (d) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};
 


// GET /api/faq?role=carowner
export const getFaq = async (req, res) => {
  try {
    const { role } = req.query || {};
 
    if (!role) {
      return res.status(400).json({ success: false, message: "role is required" });
    }
 
    const [result] = await CommonModel.aggregate([
      {
        $project: {
          faqs: {
            $filter: {
              input: "$faqs",
              as: "item",
              cond: { $eq: [{ $toLower: "$$item.role" }, role.trim().toLowerCase()] },
            },
          },
        },
      },
    ]);
 
    const faqs = result?.faqs || [];
 
    // Newest first
    faqs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
 
    return res.status(200).json({ success: true, data: faqs });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch FAQs",
      error: error.message,
    });
  }
};
 
// GET /api/privacy-and-disclaimer?country=canada&type=privacy
export const getPrivacyAndDisclaimer = async (req, res) => {
  try {
    const { country, type } = req.query || {};
 
    if (!country || !type) {
      return res.status(400).json({ success: false, message: "country and type are required" });
    }
 
    const normalizedCountry = country.trim().toLowerCase();
    const normalizedType = type.trim().toLowerCase();
 
    const [result] = await CommonModel.aggregate([
      {
        $project: {
          privacyAndDisclaimers: {
            $filter: {
              input: "$privacyAndDisclaimers",
              as: "item",
              cond: {
                $and: [
                  { $eq: [{ $toLower: "$$item.country" }, normalizedCountry] },
                  { $eq: [{ $toLower: "$$item.type" }, normalizedType] },
                ],
              },
            },
          },
        },
      },
    ]);
 
    const items = result?.privacyAndDisclaimers || [];
    items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
 
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch privacy and disclaimer content",
      error: error.message,
    });
  }
};
 
// GET /api/product-features?country=canada&role=carowner
export const getProductFeatures = async (req, res) => {
  try {
    const { country, role } = req.query || {};
 
    if (!country || !role) {
      return res.status(400).json({ success: false, message: "country and role are required" });
    }
 
    const normalizedCountry = country.trim().toLowerCase();
    const normalizedRole = role.trim().toLowerCase();
 
    const [result] = await CommonModel.aggregate([
      {
        $project: {
          productFeatures: {
            $filter: {
              input: "$productFeatures",
              as: "item",
              cond: {
                $and: [
                  { $eq: [{ $toLower: "$$item.country" }, normalizedCountry] },
                  { $eq: [{ $toLower: "$$item.role" }, normalizedRole] },
                ],
              },
            },
          },
        },
      },
    ]);
 
    const features = result?.productFeatures || [];
    features.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
 
    return res.status(200).json({ success: true, data: features });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch product features",
      error: error.message,
    });
  }
};
 




