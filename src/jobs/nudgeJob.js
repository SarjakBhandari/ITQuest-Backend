import { Notification } from '../models/Notification.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { sendNudgeMail } from '../utils/mailer.js';
import { getCurrentWeekXp, getWeekStart } from '../utils/weeklyXp.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_DAYS = Number(process.env.NUDGE_INACTIVITY_DAYS ?? 2);
const QUEST_STALE_DAYS = Number(process.env.NUDGE_QUEST_STALE_DAYS ?? 3);
const COOLDOWN_HOURS = Number(process.env.NUDGE_COOLDOWN_HOURS ?? 24);
const DEADLINE_REMINDER_WINDOW_HOURS = Number(process.env.NUDGE_DEADLINE_WINDOW_HOURS ?? 24);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function calendarDayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
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

async function sendDedupedEmail(user, { subject, heading, message, dedupeKey, icon, type }) {
  const existing = await Notification.findOne({ owner: user._id, dedupeKey });
  if (existing) return false;

  await sendNudgeMail({ to: user.email, heroName: user.heroName, subject, heading, message });
  await Notification.create({ owner: user._id, dedupeKey, type, icon, title: heading, body: message, read: false });
  return true;
}

export async function runStreakReminderCheck() {
  const now = new Date();
  const today = calendarDayKey(now);

  const users = await User.find({ emailNudgesEnabled: true, streak: { $gt: 0 } });

  for (const user of users) {
    const loggedInToday = user.lastLoginAt && calendarDayKey(user.lastLoginAt) === today;
    if (loggedInToday) continue;

    const remindedToday = user.lastStreakReminderAt && calendarDayKey(user.lastStreakReminderAt) === today;
    if (remindedToday) continue;

    // eslint-disable-next-line no-await-in-loop
    await sendNudgeMail({
      to: user.email,
      heroName: user.heroName,
      subject: 'Keep your streak alive',
      heading: `Your ${user.streak}-day streak is on the line.`,
      message: "You haven't logged in today yet. Log in before the day ends to keep your streak going."
    });
    // eslint-disable-next-line no-await-in-loop
    await Notification.findOneAndUpdate(
      { owner: user._id, dedupeKey: `streak-reminder:${today}` },
      {
        owner: user._id,
        dedupeKey: `streak-reminder:${today}`,
        type: 'nudge-email',
        icon: 'local_fire_department',
        title: `Your ${user.streak}-day streak is on the line.`,
        body: "You haven't logged in today yet. Log in before the day ends to keep your streak going.",
        read: false
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    user.lastStreakReminderAt = now;
    // eslint-disable-next-line no-await-in-loop
    await user.save();
  }
}

export async function runDeadlineReminderCheck() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + DEADLINE_REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  const dueSoonTasks = await Task.find({
    status: { $ne: 'done' },
    examHibernated: false,
    deadlineReminderSentAt: null,
    dueDate: { $ne: null, $lte: windowEnd }
  });

  for (const task of dueSoonTasks) {
    // eslint-disable-next-line no-await-in-loop
    const user = await User.findById(task.owner);
    if (!user) continue;

    const isOverdue = task.dueDate.getTime() < now.getTime();
    const heading = isOverdue ? `"${task.title}" is overdue.` : `"${task.title}" is due soon.`;
    const message = isOverdue
      ? 'This quest passed its deadline. Finish it soon or snooze it before the XP penalty grows.'
      : `This quest is due within ${DEADLINE_REMINDER_WINDOW_HOURS} hours. Wrap it up to bank the XP on time.`;

    // eslint-disable-next-line no-await-in-loop
    await Notification.create({
      owner: user._id,
      dedupeKey: `deadline:${task._id.toString()}`,
      type: 'deadline',
      icon: 'schedule',
      title: heading,
      body: message,
      read: false
    });

    if (user.emailNudgesEnabled) {
      // eslint-disable-next-line no-await-in-loop
      await sendNudgeMail({ to: user.email, heroName: user.heroName, subject: 'Quest deadline reminder', heading, message });
    }

    task.deadlineReminderSentAt = now;
    // eslint-disable-next-line no-await-in-loop
    await task.save();
  }
}

export async function runWeeklyXpAlertCheck() {
  const weekKey = getWeekStart().toISOString().slice(0, 10);
  const users = await User.find({ weeklyXpTarget: { $gt: 0 } });

  for (const user of users) {
    // eslint-disable-next-line no-await-in-loop
    const currentWeekXp = await getCurrentWeekXp(user._id);
    const pct = (currentWeekXp / user.weeklyXpTarget) * 100;

    if (pct >= 100) {
      // eslint-disable-next-line no-await-in-loop
      await sendDedupedEmail(user, {
        subject: 'Weekly XP target reached',
        heading: 'You hit your weekly XP target!',
        message: `You earned ${currentWeekXp} XP this week, past your ${user.weeklyXpTarget} XP target. Great work.`,
        dedupeKey: `weekly-xp-100:${weekKey}`,
        icon: 'star',
        type: 'weekly-xp'
      });
    } else if (pct >= 75) {
      // eslint-disable-next-line no-await-in-loop
      await sendDedupedEmail(user, {
        subject: 'Almost at your weekly XP target',
        heading: "You're 75% of the way to your weekly XP target.",
        message: `You've earned ${currentWeekXp} of your ${user.weeklyXpTarget} XP target this week. A couple more quests will close the gap.`,
        dedupeKey: `weekly-xp-75:${weekKey}`,
        icon: 'star',
        type: 'weekly-xp'
      });
    }
  }
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

async function runAllChecks() {
  await runNudgeCheck();
  await runStreakReminderCheck();
  await runDeadlineReminderCheck();
  await runWeeklyXpAlertCheck();
}

export function startNudgeScheduler() {
  const intervalMinutes = Number(process.env.NUDGE_INTERVAL_MINUTES ?? 30);
  const intervalMs = intervalMinutes * 60 * 1000;

  setInterval(() => {
    runAllChecks().catch((error) => console.error('Nudge check failed:', error));
  }, intervalMs);
}
