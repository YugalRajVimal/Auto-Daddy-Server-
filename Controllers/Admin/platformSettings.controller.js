import {
    getPlatformSettings,
    updatePlatformSettings,
  } from "../../Schema/PlatformSettings/platformSettings.service.js";
  
  export const getSettings = async (req, res) => {
    try {
      const settings = await getPlatformSettings({ fresh: true });
      return res.status(200).json({ success: true, data: settings });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Failed to fetch settings", error: error.message });
    }
  };
  
  export const updateSettings = async (req, res) => {
    try {
      const {
        trialDays,
        minWalletRechargeAmount,
        perJobCardCharge,
        walletCurrency,
        websiteSubscriptionPrice,
        websiteSubscriptionDays,
        websiteSubscriptionHstRate,
      } = req.body;
  
      const numericFields = {
        trialDays,
        minWalletRechargeAmount,
        perJobCardCharge,
        websiteSubscriptionPrice,
        websiteSubscriptionDays,
        websiteSubscriptionHstRate,
      };
      for (const [key, val] of Object.entries(numericFields)) {
        if (val !== undefined && (typeof val !== "number" || val < 0 || Number.isNaN(val))) {
          return res.status(400).json({ success: false, message: `${key} must be a non-negative number` });
        }
      }
  
      const updated = await updatePlatformSettings({
        trialDays,
        minWalletRechargeAmount,
        perJobCardCharge,
        walletCurrency,
        websiteSubscriptionPrice,
        websiteSubscriptionDays,
        websiteSubscriptionHstRate,
      });
  
      return res.status(200).json({ success: true, message: "Settings updated", data: updated });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Failed to update settings", error: error.message });
    }
  };