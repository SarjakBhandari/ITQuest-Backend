import { Notification } from '../models/Notification.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { sendNudgeMail } from '../utils/mailer.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_DAYS = Number(process.env.NUDGE_INACTIVITY_DAYS ?? 2);
const QUEST_STALE_DAYS = Number(process.env.NUDGE_QUEST_STALE_DAYS ?? 3);
const COOLDOWN_HOURS = Number(process.env.NUDGE_COOLDOWN_HOURS ?? 24);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isPastCooldown(user, now) {
  if (!user.lastNudgeEmailAt) return true;
  return now.getTime() - user.lastNudgeEmailAt.getTime() > COOLDOWN_HOURS * 60 * 60 * 1000;
}

async function nudgeUser(user, { subject, heading, message, dedupeKey, icon }) {
  await sendNudgeMail({ to: user.email, heroName: user.heroName, subject, heading, message });
  await Notification.findOneAndUpdate(
    { owner: user._id, dedupeKey },
    { owner: user._id, dedupeKey, type: 'nudge-email', icon, title: heading, body: message, read: false },
    { upsert: true, setDefaultsOnInsert: true }
  );
  user.lastNudgeEmailAt = new Date();
  await user.save();
}

export async function runNudgeCheck() {
  const now = new Date();
  const users = await User.find({ emailNudgesEnabled: true });

  for (const user of users) {
    if (!isPastCooldown(user, now)) continue;

    const inactiveForMs = user.lastLoginAt ? now.getTime() - user.lastLoginAt.getTime() : Infinity;
    if (inactiveForMs > INACTIVITY_DAYS * DAY_MS) {
      const days = Math.floor(inactiveForMs / DAY_MS);
      // eslint-disable-next-line no-await-in-loop
      await nudgeUser(user, {
        subject: 'We miss you, adventurer',
        heading: "Your streak is waiting for you!",
        message: `You haven't logged in for ${days} days. Come back before your streak fades and your guildmates pull ahead.`,
        dedupeKey: `inactivity-email:${todayKey()}`,
        icon: 'local_fire_department'
      });
      continue;
    }

    const staleForMs = user.lastQuestActivityAt ? now.getTime() - user.lastQuestActivityAt.getTime() : null;
    if (staleForMs !== null && staleForMs > QUEST_STALE_DAYS * DAY_MS) {
      // eslint-disable-next-line no-await-in-loop
      const openQuestCount = await Task.countDocuments({ owner: user._id, status: { $ne: 'done' } });
      if (openQuestCount > 0) {
        const days = Math.floor(staleForMs / DAY_MS);
        // eslint-disable-next-line no-await-in-loop
        await nudgeUser(user, {
          subject: 'Your quests are gathering dust',
          heading: 'Unfinished quests are calling.',
          message: `You have ${openQuestCount} quest${openQuestCount === 1 ? '' : 's'} waiting and haven't touched your board in ${days} days. A small step keeps your XP flowing.`,
          dedupeKey: `quest-stale-email:${todayKey()}`,
          icon: 'swords'
        });
      }
    }
  }
}

export function startNudgeScheduler() {
  const intervalMinutes = Number(process.env.NUDGE_INTERVAL_MINUTES ?? 30);
  const intervalMs = intervalMinutes * 60 * 1000;

  setInterval(() => {
    runNudgeCheck().catch((error) => console.error('Nudge check failed:', error));
  }, intervalMs);
}
