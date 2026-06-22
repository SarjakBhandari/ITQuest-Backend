import { Notification } from '../models/Notification.js';
import { Task } from '../models/Task.js';
import { getLevelProgress } from '../utils/xp.js';
import { buildAchievements } from '../utils/achievements.js';
import { isTaskOverdue, withDerivedFields } from '../utils/questXp.js';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function upsertNotification(userId, dedupeKey, fields) {
  // $set only updates content fields - it never touches `read`, so a notification the
  // user already dismissed stays read even if the same trigger condition fires again.
  await Notification.findOneAndUpdate(
    { owner: userId, dedupeKey },
    { $set: { owner: userId, dedupeKey, ...fields }, $setOnInsert: { read: false } },
    { upsert: true }
  );
}

async function refreshNotifications(user) {
  const rawTasks = await Task.find({ owner: user._id });
  const tasks = rawTasks.map(withDerivedFields);
  const inProgressTasks = tasks.filter((task) => task.status === 'in-progress');
  const overdueTasks = tasks.filter((task) => task.status !== 'done' && isTaskOverdue(task));
  const doneTasks = tasks.filter((task) => task.status === 'done');

  if (inProgressTasks.length > user.maxActiveQuests) {
    await upsertNotification(user._id, `overload:${todayKey()}`, {
      type: 'overload',
      icon: 'warning',
      title: 'System overload',
      body: `You have ${inProgressTasks.length} active quests, above your limit of ${user.maxActiveQuests}. Pause or finish a few to cool down.`
    });
  }

  if (overdueTasks.length > 0) {
    await upsertNotification(user._id, `overdue:${todayKey()}`, {
      type: 'overdue',
      icon: 'schedule',
      title: 'Overdue quests',
      body: `${overdueTasks.length} quest${overdueTasks.length === 1 ? '' : 's'} ${overdueTasks.length === 1 ? 'is' : 'are'} overdue. Catch up before XP penalties stack up.`
    });
  }

  const categories = new Set(doneTasks.map((task) => task.category));
  const { level } = getLevelProgress(user.xp);
  const achievements = buildAchievements(user, categories.size, level);

  for (const achievement of achievements) {
    if (achievement.earned || achievement.progress === 0) continue;
    const remaining = achievement.target - achievement.progress;
    if (remaining > 0 && remaining <= Math.max(1, Math.ceil(achievement.target * 0.15))) {
      await upsertNotification(user._id, `almost:${achievement.id}`, {
        type: 'achievement',
        icon: achievement.icon,
        title: 'Almost there!',
        body: `You're ${remaining} away from unlocking "${achievement.label}".`
      });
    }
  }
}

export async function listNotifications(req, res, next) {
  try {
    await refreshNotifications(req.user);

    const notifications = await Notification.find({ owner: req.user._id }).sort({ createdAt: -1 }).limit(30);
    const unreadCount = notifications.filter((notification) => !notification.read).length;

    res.status(200).json({
      ok: true,
      unreadCount,
      notifications: notifications.map((notification) => ({
        id: notification._id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        read: notification.read,
        createdAt: notification.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    await Notification.updateOne({ _id: req.params.id, owner: req.user._id }, { read: true });
    res.status(200).json({ ok: true, message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    await Notification.updateMany({ owner: req.user._id, read: false }, { read: true });
    res.status(200).json({ ok: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
}
