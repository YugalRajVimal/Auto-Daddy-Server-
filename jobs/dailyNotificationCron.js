// jobs/dailyNotificationCron.js
import cron from "node-cron";
import { User } from "../Schema/user.schema.js";
import { NOTIFICATION_RULES } from "../services/notificationRules.js";

const BATCH_SIZE = 400; // FCM sendEach() caps at 500 messages/call
// const TIMEZONE = "Asia/Kolkata";
const TIMEZONE = "America/Toronto";

function isSameDay(d1, d2) {
  if (!d1) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

async function sendBatch(firebaseAdmin, rule, batch, today) {
  if (!batch.length) return { sent: 0, failed: 0 };

  const messages = batch.map((u) => ({
    token: u.fcmToken,
    notification: {
      title: u._pendingMessage.title,
      body: u._pendingMessage.body,
    },
    data: { type: rule.type, ruleId: rule.id },
  }));

  let response;
  try {
    response = await firebaseAdmin.messaging().sendEach(messages);
  } catch (err) {
    console.error(`[dailyNotificationCron] ${rule.id} sendEach failed:`, err);
    return { sent: 0, failed: batch.length };
  }

  const bulkOps = [];
  const staleTokenUserIds = [];

  response.responses.forEach((r, idx) => {
    const user = batch[idx];
    if (r.success) {
      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { [`notificationLogs.${rule.id}`]: today } },
        },
      });
    } else if (
      r.error?.code === "messaging/registration-token-not-registered" ||
      r.error?.code === "messaging/invalid-registration-token"
    ) {
      // token is dead — clear it so we stop retrying it every day
      staleTokenUserIds.push(user._id);
    } else {
      console.error(
        `[dailyNotificationCron] ${rule.id} failed for user ${user._id}:`,
        r.error?.message
      );
    }
  });

  if (bulkOps.length) await User.bulkWrite(bulkOps);
  if (staleTokenUserIds.length) {
    await User.updateMany(
      { _id: { $in: staleTokenUserIds } },
      { $set: { fcmToken: null } }
    );
  }

  const sent = response.responses.filter((r) => r.success).length;
  return { sent, failed: batch.length - sent };
}

async function runRule(firebaseAdmin, rule) {
  const today = new Date();

  // Rules can preload shared data once per run (e.g. today's Thought-of-the-Day
  // entries) instead of re-fetching it per user inside buildMessage.
  const ctx = rule.preload ? await rule.preload() : null;

  let query = User.find(rule.getQuery()).select(
    "name fcmToken notificationLogs businessProfile countryCode"
  );
  if (rule.populate) query = query.populate(rule.populate);
  const cursor = query.cursor();

  let batch = [];
  let sent = 0,
    failed = 0,
    skipped = 0;

  for await (const user of cursor) {
    const lastSent = user.notificationLogs?.get?.(rule.id);
    if (isSameDay(lastSent, today)) {
      skipped++;
      continue;
    }

    const message = await rule.buildMessage(user, ctx);
    if (!message) {
      // rule decided this user doesn't qualify right now
      // (e.g. no matching ToTD for their country, subscription outside window)
      skipped++;
      continue;
    }

    user._pendingMessage = message;
    batch.push(user);

    if (batch.length >= BATCH_SIZE) {
      const res = await sendBatch(firebaseAdmin, rule, batch, today);
      sent += res.sent;
      failed += res.failed;
      batch = [];
    }
  }

  if (batch.length) {
    const res = await sendBatch(firebaseAdmin, rule, batch, today);
    sent += res.sent;
    failed += res.failed;
  }

  console.log(
    `[dailyNotificationCron] "${rule.id}" — sent=${sent} failed=${failed} skipped=${skipped}`
  );
}

function groupRulesBySchedule(rules) {
  const groups = new Map();
  for (const rule of rules) {
    if (!rule.schedule) {
      throw new Error(
        `[dailyNotificationCron] Rule "${rule.id}" is missing a "schedule".`
      );
    }
    if (!groups.has(rule.schedule)) groups.set(rule.schedule, []);
    groups.get(rule.schedule).push(rule);
  }
  return groups;
}

export function startDailyNotificationCron() {
  console.log("[dailyNotificationCron] Cron registered.");

  const groups = groupRulesBySchedule(NOTIFICATION_RULES);

  for (const [schedule, rules] of groups.entries()) {
    cron.schedule(
      schedule,
      async () => {
        const firebaseAdmin = (await import("../config/firebase.js")).default;
        console.log(
          `[dailyNotificationCron] Starting run for schedule "${schedule}" (${rules
            .map((r) => r.id)
            .join(", ")})...`
        );
        for (const rule of rules) {
          try {
            await runRule(firebaseAdmin, rule);
          } catch (err) {
            console.error(`[dailyNotificationCron] Rule "${rule.id}" crashed:`, err);
          }
        }
        console.log(`[dailyNotificationCron] Run complete for schedule "${schedule}".`);
      },
      { timezone: TIMEZONE }
    );
  }
}