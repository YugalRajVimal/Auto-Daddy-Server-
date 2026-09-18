import PlatformSettingsModel from "./platformSettings.schema.js";

const SETTINGS_ID = "platform-settings";
const CACHE_TTL_MS = 30 * 1000; // short cache so Admin edits take effect fast

let cache = null;
let cacheAt = 0;

export async function getPlatformSettings({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && cache && now - cacheAt < CACHE_TTL_MS) return cache;

  let doc = await PlatformSettingsModel.findById(SETTINGS_ID);
  if (!doc) {
    doc = await PlatformSettingsModel.create({ _id: SETTINGS_ID });
  }

  cache = doc.toObject();
  cacheAt = now;
  return cache;
}

export function invalidatePlatformSettingsCache() {
  cache = null;
  cacheAt = 0;
}

export async function updatePlatformSettings(patch) {
  const allowed = [
    "trialDays",
    "minWalletRechargeAmount",
    "perJobCardCharge",
    "walletCurrency",
    "websiteSubscriptionPrice",
    "websiteSubscriptionDays",
    "websiteSubscriptionHstRate",
  ];
  const update = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) update[key] = patch[key];
  }

  const doc = await PlatformSettingsModel.findByIdAndUpdate(
    SETTINGS_ID,
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  invalidatePlatformSettingsCache();
  return doc.toObject();
}