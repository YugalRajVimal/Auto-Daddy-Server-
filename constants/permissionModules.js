// // constants/permissionModules.js
// //
// // SINGLE SOURCE OF TRUTH for the Roles & Permissions module/sub-module tree.
// // The frontend module registry (config/permissionModules.ts) MUST mirror this
// // exactly — same keys, same nesting. If you add/remove/rename a module here,
// // mirror the change on the frontend or nav filtering + route guards will
// // silently stop matching permission checks.
// //
// // Shape:
// //   NAV_MODULE
// //     -> "view" (boolean) controls whether the top-level nav item is visible
// //     -> subNav keys (or none) each carrying the 4 base actions:
// //          view | create | update | delete
// //
// // A nav with NO sub-nav (e.g. "reports") still gets a single implicit
// // sub-module using the same key as the nav itself, so every leaf module in
// // the permission tree has a uniform { view, create, update, delete } shape.
// // This keeps the DB schema and the `can()`/`requirePermission()` checks
// // simple: leaves always look the same, only the tree shape changes.

// export const BASE_ACTIONS = ["view", "create", "update", "delete"];

// /**
//  * PERMISSION_TREE
//  * { [navKey]: { label, subNav: { [subNavKey]: { label } } } }
//  *
//  * This is metadata only (used to build the default-permissions object and
//  * to validate incoming permission payloads) — it does NOT itself carry
//  * boolean values. Actual granted/denied booleans live on the StaffUser
//  * document, shaped by buildDefaultPermissions() below.
//  */
// export const PERMISSION_TREE = {
//   home: {
//     label: "Home",
//     subNav: {
//       dashboard: { label: "Dashboard" },
//       thoughtOfDay: { label: "Thought of the Day" },
//       features: { label: "Features" },
//       faqs: { label: "FAQs" },
//       privacy: { label: "Privacy" },
//       websiteTemplate: { label: "Website Template" },
//       invoiceTemplate: { label: "Invoice Template" },
//     },
//   },
//   location: {
//     label: "Location",
//     subNav: {
//       provinces: { label: "Provinces" },
//       cities: { label: "Cities" },
//     },
//   },
//   services: {
//     label: "Services",
//     subNav: {
//       services: { label: "Services" },
//       subServices: { label: "Sub Services" },
//       carBrands: { label: "Car Brands" },
//     },
//   },
//   carCompanies: {
//     label: "Car Companies",
//     subNav: {
//       carCompanies: { label: "Car Companies" },
//     },
//   },
//   users: {
//     label: "Users",
//     subNav: {
//       carOwners: { label: "Car Owners" },
//       autoShopOwners: { label: "Auto Shop Owners" },
//       dealers: { label: "Dealers" },
//       associates: { label: "Associates" },
//     },
//   },
//   leads: {
//     label: "Leads",
//     subNav: {
//       allLeads: { label: "All Leads" },
//       visitedLeads: { label: "Visited Leads" },
//       completedLeads: { label: "Completed Leads" },
//     },
//   },
//   accounts: {
//     label: "Accounts",
//     subNav: {
//       expenses: { label: "Expenses" },
//       bank: { label: "Bank" },
//     },
//   },
//   invoices: {
//     label: "Invoices",
//     subNav: {
//       invoices: { label: "Invoices" },
//       items: { label: "Items" },
//     },
//   },
//   messages: {
//     label: "Messages",
//     subNav: {
//       sent: { label: "Sent" },
//       received: { label: "Received" },
//     },
//   },
//   reports: {
//     label: "Reports",
//     subNav: {
//       reports: { label: "Reports" }, // no real sub-nav in UI; implicit leaf
//     },
//   },
//   domain: {
//     label: "Domain",
//     subNav: {
//       domainManager: { label: "Domain Manager" },
//     },
//   },
//   runningDeals: {
//     label: "Running Deals",
//     subNav: {
//       runningDeals: { label: "Running Deals" },
//     },
//   },
//   wallet: {
//     label: "Wallet",
//     subNav: {
//       wallet: { label: "Wallet" },
//     },
//   },
//   tasks: {
//     label: "Tasks",
//     subNav: {
//       tasks: { label: "Tasks" },
//     },
//   },
//   roleManagement: {
//     label: "Role Management",
//     subNav: {
//       staffUsers: { label: "Staff Users" },
//     },
//   },
// };

// /**
//  * Builds a fully-populated permissions object with every nav/sub-nav key
//  * present and every action set to `false`. Use this as the starting point
//  * when creating a new StaffUser, then merge in whatever the SuperAdmin
//  * actually grants.
//  */
// export function buildDefaultPermissions() {
//   const perms = {};
//   for (const [navKey, navDef] of Object.entries(PERMISSION_TREE)) {
//     perms[navKey] = { view: false, subNav: {} };
//     for (const subKey of Object.keys(navDef.subNav)) {
//       perms[navKey].subNav[subKey] = {
//         view: false,
//         create: false,
//         update: false,
//         delete: false,
//       };
//     }
//   }
//   return perms;
// }

// /** Flat list of "navKey.subNavKey" paths — useful for validation/UI. */
// export function listAllModulePaths() {
//   const paths = [];
//   for (const [navKey, navDef] of Object.entries(PERMISSION_TREE)) {
//     for (const subKey of Object.keys(navDef.subNav)) {
//       paths.push(`${navKey}.${subKey}`);
//     }
//   }
//   return paths;
// }

// export function isValidNav(navKey) {
//   return Object.prototype.hasOwnProperty.call(PERMISSION_TREE, navKey);
// }

// export function isValidSubNav(navKey, subNavKey) {
//   return isValidNav(navKey) && Object.prototype.hasOwnProperty.call(PERMISSION_TREE[navKey].subNav, subNavKey);
// }

// // constants/permissionModules.js


// constants/permissionModules.js
//
// SINGLE SOURCE OF TRUTH for the Roles & Permissions module/sub-module tree.
// The frontend module registry (config/permissionModules.ts) MUST mirror this
// exactly — same keys, same nesting. If you add/remove/rename a module here,
// mirror the change on the frontend or nav filtering + route guards will
// silently stop matching permission checks.
//
// Shape:
//   NAV_MODULE
//     -> "view" (boolean) controls whether the top-level nav item is visible
//     -> subNav keys (or none) each carrying the 4 base actions:
//          view | create | update | delete
//
// A nav with NO sub-nav (e.g. "reports") still gets a single implicit
// sub-module using the same key as the nav itself, so every leaf module in
// the permission tree has a uniform { view, create, update, delete } shape.
// This keeps the DB schema and the `can()`/`requirePermission()` checks
// simple: leaves always look the same, only the tree shape changes.

export const BASE_ACTIONS = ["view", "create", "update", "delete"];

/**
 * PERMISSION_TREE
 * { [navKey]: { label, subNav: { [subNavKey]: { label } } } }
 *
 * This is metadata only (used to build the default-permissions object and
 * to validate incoming permission payloads) — it does NOT itself carry
 * boolean values. Actual granted/denied booleans live on the StaffUser
 * document, shaped by buildDefaultPermissions() below.
 */
export const PERMISSION_TREE = {
  home: {
    label: "Home",
    subNav: {
      dashboard: { label: "Dashboard" },
      thoughtOfDay: { label: "Thought of the Day" },
      features: { label: "Features" },
      faqs: { label: "FAQs" },
      privacy: { label: "Privacy" },
      websiteTemplate: { label: "Website Template" },
      invoiceTemplate: { label: "Invoice Template" },
    },
  },
  location: {
    label: "Location",
    subNav: {
      provinces: { label: "Provinces" },
      cities: { label: "Cities" },
    },
  },
  services: {
    label: "Services",
    subNav: {
      services: { label: "Services" },
      subServices: { label: "Sub Services" },
      carBrands: { label: "Car Brands" },
    },
  },
  carCompanies: {
    label: "Car Companies",
    subNav: {
      carCompanies: { label: "Car Companies" },
    },
  },
  users: {
    label: "Users",
    subNav: {
      carOwners: { label: "Car Owners" },
      autoShopOwners: { label: "Auto Shop Owners" },
      dealers: { label: "Dealers" },
      associates: { label: "Associates" },
    },
  },
  leads: {
    label: "Leads",
    subNav: {
      allLeads: { label: "All Leads" },
      visitedLeads: { label: "Visited Leads" },
      completedLeads: { label: "Completed Leads" },
    },
  },
  accounts: {
    label: "Accounts",
    subNav: {
      expenses: { label: "Expenses" },
      bank: { label: "Bank" },
    },
  },
  invoices: {
    label: "Invoices",
    subNav: {
      invoices: { label: "Invoices" },
      items: { label: "Items" },
    },
  },
  messages: {
    label: "Messages",
    subNav: {
      sent: { label: "Sent" },
      received: { label: "Received" },
    },
  },
  reports: {
    label: "Reports",
    subNav: {
      reports: { label: "Reports" }, // no real sub-nav in UI; implicit leaf
    },
  },
  domain: {
    label: "Domain",
    subNav: {
      domainManager: { label: "Domain Manager" },
    },
  },
  runningDeals: {
    label: "Running Deals",
    subNav: {
      runningDeals: { label: "Running Deals" },
    },
  },
  wallet: {
    label: "Wallet",
    subNav: {
      wallet: { label: "Wallet" },
    },
  },
  tasks: {
    label: "Tasks",
    subNav: {
      tasks: { label: "Tasks" },
    },
  },
  roleManagement: {
    label: "Role Management",
    subNav: {
      staffUsers: { label: "Staff Users" },
    },
  },
};

// /**
//  * Builds a fully-populated permissions object with every nav/sub-nav key
//  * present and every action set to `false`. Use this as the starting point
//  * when creating a new StaffUser, then merge in whatever the SuperAdmin
//  * actually grants.
//  */
// export function buildDefaultPermissions() {
//   const perms = {};
//   for (const [navKey, navDef] of Object.entries(PERMISSION_TREE)) {
//     perms[navKey] = { view: false, subNav: {} };
//     for (const subKey of Object.keys(navDef.subNav)) {
//       perms[navKey].subNav[subKey] = {
//         view: false,
//         create: false,
//         update: false,
//         delete: false,
//       };
//     }
//   }
//   return perms;
// }

// /** Flat list of "navKey.subNavKey" paths — useful for validation/UI. */
// export function listAllModulePaths() {
//   const paths = [];
//   for (const [navKey, navDef] of Object.entries(PERMISSION_TREE)) {
//     for (const subKey of Object.keys(navDef.subNav)) {
//       paths.push(`${navKey}.${subKey}`);
//     }
//   }
//   return paths;
// }

// export function isValidNav(navKey) {
//   return Object.prototype.hasOwnProperty.call(PERMISSION_TREE, navKey);
// }

// export function isValidSubNav(navKey, subNavKey) {
//   return isValidNav(navKey) && Object.prototype.hasOwnProperty.call(PERMISSION_TREE[navKey].subNav, subNavKey);
// }

/**
 * Builds a fully-populated permissions object with every nav/sub-nav key
 * present and every action set to `false`. Use this as the starting point
 * when creating a new StaffUser, then merge in whatever the SuperAdmin
 * actually grants.
 */
export function buildDefaultPermissions() {
    const perms = {};
    for (const [navKey, navDef] of Object.entries(PERMISSION_TREE)) {
      perms[navKey] = { view: false, subNav: {} };
      for (const subKey of Object.keys(navDef.subNav)) {
        perms[navKey].subNav[subKey] = {
          view: false,
          create: false,
          update: false,
          delete: false,
        };
      }
    }
    return perms;
  }
  
  /**
   * Builds a fully-populated permissions object with every nav/sub-nav key
   * present and every action set to `true`. Used ONLY for the SuperAdmin
   * ("admin" role) response payload — SuperAdmin has no Role document and
   * bypasses all permission checks server-side; this is purely so the
   * frontend nav/matrix has a consistent shape to render against.
   *
   * Kept here (not duplicated as a recursive "makeTrueTree" walker in each
   * controller) so the "all true" shape can never drift from PERMISSION_TREE.
   */
  export function buildAllTruePermissions() {
    const perms = {};
    for (const [navKey, navDef] of Object.entries(PERMISSION_TREE)) {
      perms[navKey] = { view: true, subNav: {} };
      for (const subKey of Object.keys(navDef.subNav)) {
        perms[navKey].subNav[subKey] = {
          view: true,
          create: true,
          update: true,
          delete: true,
        };
      }
    }
    return perms;
  }
  
  /** Flat list of "navKey.subNavKey" paths — useful for validation/UI. */
  export function listAllModulePaths() {
    const paths = [];
    for (const [navKey, navDef] of Object.entries(PERMISSION_TREE)) {
      for (const subKey of Object.keys(navDef.subNav)) {
        paths.push(`${navKey}.${subKey}`);
      }
    }
    return paths;
  }
  
  export function isValidNav(navKey) {
    return Object.prototype.hasOwnProperty.call(PERMISSION_TREE, navKey);
  }
  
  export function isValidSubNav(navKey, subNavKey) {
    return isValidNav(navKey) && Object.prototype.hasOwnProperty.call(PERMISSION_TREE[navKey].subNav, subNavKey);
  }
  
  /**
 * Auto-derives each nav's `view` flag from its subNav: a nav is only
 * viewable if at least one of its sub-modules has `view: true`. This
 * runs after any merge/patch so the stored permissions object can never
 * end up with a parent tab visible while all its children are hidden
 * (or vice versa — hidden while a child is visible).
 *
 * Special case: `reports.reports` and similar "leaf" navs (single
 * subNav key matching the navKey, used as an implicit leaf in the UI)
 * still work correctly since view is just OR'd across their one subNav key.
 */
export function normalizePermissions(permissions) {
    const normalized = JSON.parse(JSON.stringify(permissions));
    for (const [navKey, navVal] of Object.entries(normalized)) {
      if (!navVal || !navVal.subNav) continue;
      const anySubViewable = Object.values(navVal.subNav).some((sub) => sub?.view === true);
      navVal.view = anySubViewable;
    }
    return normalized;
  }

  // constants/permissionModules.js
// ... existing code (BASE_ACTIONS, PERMISSION_TREE, buildDefaultPermissions,
//     buildAllTruePermissions, listAllModulePaths, isValidNav, isValidSubNav)
// ... then add this at the bottom, before the final comment:

/**
 * Resolves a "navKey" or "navKey.subKey" path against a permissions object
 * and checks ONE SPECIFIC action (view/create/update/delete).
 * Unknown nav/subNav keys, unknown actions, or missing perms all fail
 * closed (return false) — never throws.
 */
export function canPerform(perms, modulePath, action = "view") {
    if (!perms || !modulePath) return false;
    if (!BASE_ACTIONS.includes(action)) return false;
  
    const [navKey, subKey] = modulePath.split(".");
    if (!isValidNav(navKey)) return false;
  
    const nav = perms[navKey];
    if (!nav) return false;
  
    if (!subKey) return !!nav.view;
  
    if (!isValidSubNav(navKey, subKey)) return false;
    const sub = nav.subNav?.[subKey];
    if (!sub) return false;
  
    return !!sub[action];
  }
  
  // constants/permissionModules.js

  

  // constants/permissionModules.js

// constants/permissionModules.js
