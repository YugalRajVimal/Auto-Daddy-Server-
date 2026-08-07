// // services/notificationRules.js
// //
// // Central registry of daily notification rules. Each rule is fully
// // self-contained: its own Mongo query, its own schedule, its own message
// // logic. To add a new daily notification later, just add a new object here
// // — nothing in jobs/dailyNotificationCron.js needs to change.
// //
// // Rule shape:
// //   id          — unique string, also used as the notificationLogs key
// //   type        — string sent in the FCM `data` payload (for client-side routing)
// //   schedule    — cron expression (Asia/Kolkata). Rules sharing a schedule
// //                 run together in one pass.
// //   getQuery()  — returns the Mongo filter used on the User collection
// //   populate    — optional, passed straight to .populate() on the query
// //   preload()   — optional, runs ONCE per cron pass (not per user) and its
// //                 return value is passed as `ctx` into buildMessage
// //   buildMessage(user, ctx) — return { title, body } to notify this user,
// //                 or null/undefined to skip them for this run

// // Dial code -> country name used to match Common.thoughtOfTheDay.country.
// // Extend this map as you support more countries.
// const COUNTRY_CODE_MAP = {
//     "+91": "India",
//     "+1": "Canada",
//   };
  
//   export const NOTIFICATION_RULES = [
//     // ── Business profile still incomplete ────────────────────────────────
//     {
//       id: "business_profile_incomplete",
//       type: "businessProfileIncomplete",
//       schedule: "0 9 * * *", // 9:00 AM IST
//       getQuery: () => ({
//         role: "autoshopowner",
//         isAutoShopBusinessProfileComplete: false,
//         status: "active",
//         isDisabled: { $ne: true },
//         fcmToken: { $ne: null },
//       }),
//       buildMessage: (user) => ({
//         title: "Complete Your Business Profile",
//         body: `Hi ${user.name || "there"}, your business profile is still incomplete. Finish it to start getting customers on AutoDaddy.`,
//       }),
//     },
  
//     // ── Thought of the Day, matched by country + today's date ───────────
//     {
//       id: "thought_of_the_day",
//       type: "thoughtOfTheDay",
//       schedule: "0 8 * * *", // 8:00 AM IST
//       getQuery: () => ({
//         status: "active",
//         isDisabled: { $ne: true },
//         fcmToken: { $ne: null },
//       }),
//       preload: async () => {
//         const CommonModel = (await import("../Schema/common.schema.js")).default;
  
//         const now = new Date();
//         const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//         const endOfDay = new Date(startOfDay);
//         endOfDay.setDate(endOfDay.getDate() + 1);
  
//         const commonDoc = await CommonModel.findOne({}, { thoughtOfTheDay: 1 }).lean();
//         const todaysEntries = (commonDoc?.thoughtOfTheDay || []).filter((t) => {
//           const d = new Date(t.date);
//           return d >= startOfDay && d < endOfDay;
//         });
  
//         const byCountry = new Map();
//         for (const entry of todaysEntries) {
//           byCountry.set((entry.country || "").trim().toLowerCase(), entry);
//         }
//         return { byCountry };
//       },
//       buildMessage: (user, ctx) => {
//         const country = COUNTRY_CODE_MAP[user.countryCode];
//         if (!country) return null; // unmapped dial code — skip rather than guess
  
//         const entry = ctx.byCountry.get(country.toLowerCase());
//         if (!entry) return null; // nothing posted for this country today
  
//         return {
//           title: "Thought of the Day",
//           body: entry.subject,
//         };
//       },
//     },
  
//     // ── Subscription not yet purchased ───────────────────────────────────
//     {
//       id: "subscription_not_purchased",
//       type: "subscriptionNotPurchased",
//       schedule: "35 11 * * *", // 10:00 AM IST
//       getQuery: () => ({
//         role: "autoshopowner",
//         status: "active",
//         isDisabled: { $ne: true },
//         fcmToken: { $ne: null },
//         businessProfile: { $ne: null },
//       }),
//       populate: { path: "businessProfile", select: "subscriptions" },
//       buildMessage: (user) => {
//         const expiry = user.businessProfile?.computedSubscriptionExpiresAt;
//         if (expiry) return null; // has at least one paid subscription — not this rule
  
//         return {
//           title: "Activate Your Subscription",
//           body: `Hi ${user.name || "there"}, you haven't purchased a subscription yet. Subscribe now to keep your shop visible to customers.`,
//         };
//       },
//     },
//     // ── Subscription has already expired ─────────────────────────────────
//   {
//     id: "subscription_expired",
//     type: "subscriptionExpired",
//     schedule: "0 10 * * *", // same batch as the other subscription rules
//     getQuery: () => ({
//       role: "autoshopowner",
//       status: "active",
//       isDisabled: { $ne: true },
//       fcmToken: { $ne: null },
//       businessProfile: { $ne: null },
//     }),
//     populate: { path: "businessProfile", select: "subscriptions" },
//     buildMessage: (user) => {
//       const expiry = user.businessProfile?.computedSubscriptionExpiresAt;
//       if (!expiry) return null; // never purchased — handled by subscription_not_purchased

//       const msPerDay = 24 * 60 * 60 * 1000;
//       const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / msPerDay);

//       if (daysLeft >= 0) return null; // not expired yet — handled by subscription_expiring_soon

//       const daysAgo = Math.abs(daysLeft);
//       return {
//         title: "Subscription Expired",
//         body: `Hi ${user.name || "there"}, your subscription expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago. Renew now to reactivate your shop.`,
//       };
//     },
//   },
  
//     // ── Subscription ending within 7 days ────────────────────────────────
//     {
//       id: "subscription_expiring_soon",
//       type: "subscriptionExpiringSoon",
//       schedule: "0 10 * * *", // same time as above — runs in the same batch pass
//       getQuery: () => ({
//         role: "autoshopowner",
//         status: "active",
//         isDisabled: { $ne: true },
//         fcmToken: { $ne: null },
//         businessProfile: { $ne: null },
//       }),
//       populate: { path: "businessProfile", select: "subscriptions" },
//       buildMessage: (user) => {
//         const expiry = user.businessProfile?.computedSubscriptionExpiresAt;
//         if (!expiry) return null; // no subscription at all — handled by the other rule
  
//         const msPerDay = 24 * 60 * 60 * 1000;
//         const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / msPerDay);
  
//         // Window: today up to 7 days before expiry. Stops once actually expired.
//         if (daysLeft < 0 || daysLeft > 7) return null;
  
//         return {
//           title: "Subscription Ending Soon",
//           body: `Hi ${user.name || "there"}, your subscription ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Renew now to avoid any interruption.`,
//         };
//       },
//     },
//     // Add future rules here — just give each a unique id + schedule.
//   ];

// services/notificationRules.js
//
// Central registry of daily notification rules. Each rule is fully
// self-contained: its own Mongo query, its own schedule, its own message
// logic. To add a new daily notification later, just add a new object here
// — nothing in jobs/dailyNotificationCron.js needs to change.
//
// Rule shape:
//   id          — unique string, also used as the notificationLogs key
//   type        — string sent in the FCM `data` payload (for client-side routing)
//   schedule    — cron expression (America/Toronto). Rules sharing a schedule
//                 run together in one pass.
//   getQuery()  — returns the Mongo filter used on the User collection
//   populate    — optional, passed straight to .populate() on the query
//   preload()   — optional, runs ONCE per cron pass (not per user) and its
//                 return value is passed as `ctx` into buildMessage
//   buildMessage(user, ctx) — return { title, body } to notify this user,
//                 or null/undefined to skip them for this run

// Dial code -> country name used to match Common.thoughtOfTheDay.country.
// Extend this map as you support more countries.
const COUNTRY_CODE_MAP = {
    "+91": "India",
    "+1": "Canada",
  };
  
  export const NOTIFICATION_RULES = [
    // ── Thought of the Day, matched by country + today's date ───────────
    {
      id: "thought_of_the_day",
      type: "thoughtOfTheDay",
      schedule: "0 8 * * *", // 8:00 AM Canada time
      getQuery: () => ({
        status: "active",
        isDisabled: { $ne: true },
        fcmToken: { $ne: null },
      }),
      preload: async () => {
        const CommonModel = (await import("../Schema/common.schema.js")).default;
  
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
  
        const commonDoc = await CommonModel.findOne({}, { thoughtOfTheDay: 1 }).lean();
        const todaysEntries = (commonDoc?.thoughtOfTheDay || []).filter((t) => {
          const d = new Date(t.date);
          return d >= startOfDay && d < endOfDay;
        });
  
        const byCountry = new Map();
        for (const entry of todaysEntries) {
          byCountry.set((entry.country || "").trim().toLowerCase(), entry);
        }
        return { byCountry };
      },
      buildMessage: (user, ctx) => {
        const country = COUNTRY_CODE_MAP[user.countryCode];
        if (!country) return null; // unmapped dial code — skip rather than guess
  
        const entry = ctx.byCountry.get(country.toLowerCase());
        if (!entry) return null; // nothing posted for this country today
  
        return {
          title: "Thought of the Day",
          body: entry.subject,
        };
      },
    },
  
    // ── Business profile still incomplete ────────────────────────────────
    {
      id: "business_profile_incomplete",
      type: "businessProfileIncomplete",
      schedule: "0 10 * * *", // 10:00 AM Canada time
      getQuery: () => ({
        role: "autoshopowner",
        isAutoShopBusinessProfileComplete: false,
        status: "active",
        isDisabled: { $ne: true },
        fcmToken: { $ne: null },
      }),
      buildMessage: (user) => ({
        title: "Complete Your Business Profile",
        body: `Hi ${user.name || "there"}, your business profile is still incomplete. Finish it to start getting customers on AutoDaddy.`,
      }),
    },
  
    // ── Subscription not yet purchased ───────────────────────────────────
    {
      id: "subscription_not_purchased",
      type: "subscriptionNotPurchased",
      schedule: "0 14 * * *", // 2:00 PM Canada time
      getQuery: () => ({
        role: "autoshopowner",
        status: "active",
        isDisabled: { $ne: true },
        fcmToken: { $ne: null },
        businessProfile: { $ne: null },
      }),
      populate: { path: "businessProfile", select: "subscriptions" },
      buildMessage: (user) => {
        const expiry = user.businessProfile?.computedSubscriptionExpiresAt;
        if (expiry) return null; // has at least one paid subscription — not this rule
  
        return {
          title: "Activate Your Subscription",
          body: `Hi ${user.name || "there"}, you haven't purchased a subscription yet. Subscribe now to keep your shop visible to customers.`,
        };
      },
    },
  
    // ── Subscription ending within 7 days ────────────────────────────────
    {
      id: "subscription_expiring_soon",
      type: "subscriptionExpiringSoon",
      schedule: "0 17 * * *", // 5:00 PM Canada time
      getQuery: () => ({
        role: "autoshopowner",
        status: "active",
        isDisabled: { $ne: true },
        fcmToken: { $ne: null },
        businessProfile: { $ne: null },
      }),
      populate: { path: "businessProfile", select: "subscriptions" },
      buildMessage: (user) => {
        const expiry = user.businessProfile?.computedSubscriptionExpiresAt;
        if (!expiry) return null; // no subscription at all — handled by subscription_not_purchased
  
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / msPerDay);
  
        // Window: today up to 7 days before expiry. Stops once actually expired.
        if (daysLeft < 0 || daysLeft > 7) return null;
  
        return {
          title: "Subscription Ending Soon",
          body: `Hi ${user.name || "there"}, your subscription ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Renew now to avoid any interruption.`,
        };
      },
    },
  
    // ── Subscription has already expired ─────────────────────────────────
    {
      id: "subscription_expired",
      type: "subscriptionExpired",
      schedule: "30 17 * * *", // 5:30 PM Canada time
      getQuery: () => ({
        role: "autoshopowner",
        status: "active",
        isDisabled: { $ne: true },
        fcmToken: { $ne: null },
        businessProfile: { $ne: null },
      }),
      populate: { path: "businessProfile", select: "subscriptions" },
      buildMessage: (user) => {
        const expiry = user.businessProfile?.computedSubscriptionExpiresAt;
        if (!expiry) return null; // never purchased — handled by subscription_not_purchased
  
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / msPerDay);
  
        if (daysLeft >= 0) return null; // not expired yet — handled by subscription_expiring_soon
  
        const daysAgo = Math.abs(daysLeft);
        return {
          title: "Subscription Expired",
          body: `Hi ${user.name || "there"}, your subscription expired ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago. Renew now to reactivate your shop.`,
        };
      },
    },
  
    // Add future rules here — just give each a unique id + schedule.
  ];