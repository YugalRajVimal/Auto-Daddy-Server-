
import BusinessProfileModel from "../../Schema/bussiness-profile.js";

import { User } from "../../Schema/user.schema.js";

/* Helper: resolve the caller's businessProfile id from DB (req.user only
   ever has { id, role, ... } from jwtAuth — never businessProfile). Same
   pattern used across every other autoshop controller. */
async function getBusinessId(userId) {
  const user = await User.findById(userId).select("businessProfile");
  return user?.businessProfile || null;
}

const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:mm", 24hr

/**
 * Normalize any incoming date input to midnight UTC, so date-only
 * equality checks (for special-day overrides) are stable regardless of
 * what time-of-day component the client happens to send.
 */
function normalizeToMidnight(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function validateTimingEntry(entry, { requireDay = false, requireDate = false } = {}) {
  if (requireDay) {
    if (!entry.day || !VALID_DAYS.includes(entry.day)) {
      return `day must be one of: ${VALID_DAYS.join(", ")}`;
    }
  }
  if (requireDate) {
    const normalized = normalizeToMidnight(entry.date);
    if (!normalized) return "A valid date is required";
  }
  if (!entry.isClosed) {
    if (entry.open !== undefined && entry.open !== null && !TIME_REGEX.test(entry.open)) {
      return `open must be in "HH:mm" 24-hour format (got "${entry.open}")`;
    }
    if (entry.close !== undefined && entry.close !== null && !TIME_REGEX.test(entry.close)) {
      return `close must be in "HH:mm" 24-hour format (got "${entry.close}")`;
    }
  }
  return null;
}

/* =========================================================
   1. UPDATE WEEKLY DEFAULT HOURS (perDayOpenHours)
      Route: PUT /business/open-hours/weekly
      Body: { perDayOpenHours: [{ day, open, close, isClosed }] }
      Full replace — send all 7 days each time.
   ========================================================= */
export const updateWeeklyOpenHours = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { perDayOpenHours } = req.body;

    if (!Array.isArray(perDayOpenHours) || perDayOpenHours.length === 0) {
      return res.status(400).json({
        success: false,
        message: "perDayOpenHours array is required (one entry per day you want to set)",
      });
    }

    const seenDays = new Set();
    for (const entry of perDayOpenHours) {
      const err = validateTimingEntry(entry, { requireDay: true });
      if (err) {
        return res.status(400).json({ success: false, message: `Invalid entry for "${entry.day || "unknown"}": ${err}` });
      }
      if (seenDays.has(entry.day)) {
        return res.status(400).json({ success: false, message: `Duplicate entry for "${entry.day}"` });
      }
      seenDays.add(entry.day);
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    business.perDayOpenHours = perDayOpenHours.map((entry) => ({
      day: entry.day,
      open: entry.isClosed ? undefined : entry.open,
      close: entry.isClosed ? undefined : entry.close,
      isClosed: !!entry.isClosed,
    }));

    await business.save();

    return res.status(200).json({
      success: true,
      message: "Weekly open hours updated successfully",
      data: business.perDayOpenHours,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update weekly open hours",
      error: error.message,
    });
  }
};

/* =========================================================
   2. ADD / UPDATE A SPECIAL (DATE-SPECIFIC) OVERRIDE
      Route: PUT /business/open-hours/special
      Body: { date, open?, close?, isClosed?, reason? }
      Upserts by date — if an override already exists for that exact
      calendar date, it's replaced; otherwise a new one is added.
      Does NOT affect perDayOpenHours or any other date.
   ========================================================= */
export const upsertSpecialDayOpenHours = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const { date, open, close, isClosed, reason } = req.body;

    const normalizedDate = normalizeToMidnight(date);
    if (!normalizedDate) {
      return res.status(400).json({ success: false, message: "A valid date is required" });
    }

    const err = validateTimingEntry({ open, close, isClosed });
    if (err) {
      return res.status(400).json({ success: false, message: err });
    }

    if (!isClosed && !open && !close) {
      return res.status(400).json({
        success: false,
        message: "Provide open/close times, or set isClosed: true",
      });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const existingIndex = business.specialDayOpenHours.findIndex(
      (d) => normalizeToMidnight(d.date).getTime() === normalizedDate.getTime()
    );

    const newEntry = {
      date: normalizedDate,
      open: isClosed ? undefined : open,
      close: isClosed ? undefined : close,
      isClosed: !!isClosed,
      reason: reason || undefined,
    };

    let action;
    if (existingIndex !== -1) {
      business.specialDayOpenHours[existingIndex].set(newEntry);
      action = "updated";
    } else {
      business.specialDayOpenHours.push(newEntry);
      action = "added";
    }

    await business.save();

    return res.status(200).json({
      success: true,
      message: `Special day override ${action} for ${normalizedDate.toISOString().slice(0, 10)}`,
      data: business.specialDayOpenHours.find(
        (d) => normalizeToMidnight(d.date).getTime() === normalizedDate.getTime()
      ),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to save special day override",
      error: error.message,
    });
  }
};

/* =========================================================
   3. REMOVE A SPECIAL (DATE-SPECIFIC) OVERRIDE
      Route: DELETE /business/open-hours/special/:date
      :date as "YYYY-MM-DD". Reverts that date back to the normal
      weekly schedule (perDayOpenHours) since the override is gone.
   ========================================================= */
export const removeSpecialDayOpenHours = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const normalizedDate = normalizeToMidnight(req.params.date);
    if (!normalizedDate) {
      return res.status(400).json({ success: false, message: "Invalid date param, expected YYYY-MM-DD" });
    }

    const business = await BusinessProfileModel.findById(businessId);
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const before = business.specialDayOpenHours.length;
    business.specialDayOpenHours = business.specialDayOpenHours.filter(
      (d) => normalizeToMidnight(d.date).getTime() !== normalizedDate.getTime()
    );

    if (business.specialDayOpenHours.length === before) {
      return res.status(404).json({
        success: false,
        message: `No special override found for ${normalizedDate.toISOString().slice(0, 10)}`,
      });
    }

    await business.save();

    return res.status(200).json({
      success: true,
      message: `Special day override removed for ${normalizedDate.toISOString().slice(0, 10)}. This date now follows the normal weekly schedule.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove special day override",
      error: error.message,
    });
  }
};

/* =========================================================
   4. GET COMBINED OPEN HOURS
      Route: GET /business/open-hours?startDate=&endDate=
      Always returns the full weekly schedule (perDayOpenHours).
      If startDate/endDate are given, ALSO returns:
        - specialDayOverrides: raw override docs within that range
        - effectiveSchedule: one entry PER CALENDAR DATE in the range,
          with the override applied where one exists, otherwise
          falling back to that date's weekday default — so the
          frontend doesn't have to merge the two lists itself.
      Without a date range, specialDayOverrides returns ALL overrides
      ever set (past + future), and effectiveSchedule is omitted
      (there's no bounded range to enumerate dates over).
   ========================================================= */
export const getOpenHours = async (req, res) => {
  try {
    const businessId = await getBusinessId(req.user.id);
    if (!businessId) {
      return res.status(404).json({ success: false, message: "Business profile not found" });
    }

    const business = await BusinessProfileModel.findById(businessId).select(
      "perDayOpenHours specialDayOpenHours"
    );
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const { startDate, endDate } = req.query;

    const weeklySchedule = business.perDayOpenHours || [];
    const weeklyByDay = new Map(weeklySchedule.map((d) => [d.day, d]));

    // No date range given: return weekly + all overrides ever set, no merged view.
    if (!startDate && !endDate) {
      return res.status(200).json({
        success: true,
        data: {
          weeklySchedule,
          specialDayOverrides: business.specialDayOpenHours || [],
          effectiveSchedule: null,
        },
      });
    }

    const start = normalizeToMidnight(startDate || endDate);
    const end = normalizeToMidnight(endDate || startDate);
    if (!start || !end) {
      return res.status(400).json({ success: false, message: "Invalid startDate/endDate" });
    }
    if (start.getTime() > end.getTime()) {
      return res.status(400).json({ success: false, message: "startDate must be before or equal to endDate" });
    }

    // Cap the range to avoid someone requesting a 50-year window and
    // generating tens of thousands of effectiveSchedule entries.
    const MAX_DAYS = 366;
    const spanDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (spanDays > MAX_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Date range too large (${spanDays} days). Max allowed is ${MAX_DAYS} days.`,
      });
    }

    const overridesInRange = (business.specialDayOpenHours || []).filter((d) => {
      const t = normalizeToMidnight(d.date).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
    const overrideByDate = new Map(
      overridesInRange.map((d) => [normalizeToMidnight(d.date).getTime(), d])
    );

    const effectiveSchedule = [];
    const dayNames = VALID_DAYS; // ["Monday", ..., "Sunday"]
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const dateKey = cursor.getTime();
      const override = overrideByDate.get(dateKey);
      // getUTCDay(): 0=Sunday..6=Saturday — map to your day-name strings
      const weekdayName = dayNames[(cursor.getUTCDay() + 6) % 7]; // shift so 0=Monday
      const weeklyDefault = weeklyByDay.get(weekdayName);

      effectiveSchedule.push({
        date: new Date(cursor).toISOString().slice(0, 10),
        day: weekdayName,
        source: override ? "override" : "weekly",
        open: override ? override.open : weeklyDefault?.open,
        close: override ? override.close : weeklyDefault?.close,
        isClosed: override ? !!override.isClosed : !!weeklyDefault?.isClosed,
        reason: override ? override.reason : undefined,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return res.status(200).json({
      success: true,
      data: {
        weeklySchedule,
        specialDayOverrides: overridesInRange,
        effectiveSchedule,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch open hours",
      error: error.message,
    });
  }
};